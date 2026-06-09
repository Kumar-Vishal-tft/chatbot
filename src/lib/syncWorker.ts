import { redis } from './redis';

const BATCH_SYNC_INTERVAL_MS = 30000; // 30 seconds
let workerInterval: NodeJS.Timeout | null = null;

export function startSyncWorker() {
  if (workerInterval) {
    console.log('Background Sync Worker is already running.');
    return;
  }

  console.log('Starting Background Sync Worker (Polling every 30 seconds)...');

  workerInterval = setInterval(async () => {
    try {
      await processActiveUsersSync();
    } catch (error) {
      console.error('Error during background sync worker execution:', error);
    }
  }, BATCH_SYNC_INTERVAL_MS);
}

export function stopSyncWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('Background Sync Worker stopped.');
  }
}

export async function processActiveUsersSync() {
  // 1. Fetch all users from active_users registry
  const activeUsers = await redis.smembers('active_users');
  if (activeUsers.length === 0) {
    return;
  }

  console.log(`Background Sync Worker: Checking activity status for ${activeUsers.length} users...`);

  for (const userId of activeUsers) {
    try {
      // 2. Check if the user activity flag key exists
      const activeFlagKey = `chat:user:${userId}:active`;
      const isActive = await redis.exists(activeFlagKey);

      if (isActive === 0) {
        // User has been inactive for > 15 minutes (flag expired)
        console.log(`User ${userId} is inactive. Initiating batch sync...`);

        // 3. Acquire duplicate protection sync lock (valid for 60 seconds)
        const lockKey = `chat:user:${userId}:sync_lock`;
        const acquired = await redis.set(lockKey, 'true', 'EX', 60, 'NX');

        if (acquired === 'OK') {
          try {
            await syncUserMessages(userId);
          } finally {
            // Make sure lock is deleted only if sync has completed or failed
            await redis.del(lockKey);
          }
        } else {
          console.warn(`Sync lock already held for user ${userId}. Skipping this cycle.`);
        }
      }
    } catch (err) {
      console.error(`Error processing sync check for user ${userId}:`, err);
    }
  }
}

async function syncUserMessages(userId: string) {
  const messagesKey = `chat:user:${userId}:messages`;
  const rawMessages = await redis.lrange(messagesKey, 0, -1);

  if (rawMessages.length === 0) {
    // No messages to sync, clean up registry
    console.log(`No messages found for inactive user ${userId}. Cleaning up registry...`);
    await redis.srem('active_users', userId);
    await redis.del(`chat:user:${userId}:last_activity`);
    return;
  }

  // Parse messages and extract session_id
  let sessionId = 'unknown-session';
  const parsedMessages = [];

  for (const rawMsg of rawMessages) {
    try {
      const msg = JSON.parse(rawMsg);
      if (msg.session_id) {
        sessionId = msg.session_id;
      }
      parsedMessages.push({
        role: msg.role,
        message: msg.message,
        timestamp: msg.timestamp,
      });
    } catch (e) {
      console.error(`Failed to parse raw message for user ${userId}:`, rawMsg, e);
    }
  }

  // Construct backward-compatible chat pairs for the existing backend
  const chatPairs: { user: string; agent: string }[] = [];
  for (let i = 0; i < parsedMessages.length; i++) {
    if (parsedMessages[i].role === 'user') {
      const userContent = parsedMessages[i].message;
      let agentContent = '';
      for (let j = i + 1; j < parsedMessages.length; j++) {
        if (parsedMessages[j].role === 'assistant') {
          agentContent = parsedMessages[j].message;
          break;
        }
      }
      chatPairs.push({
        user: userContent,
        agent: agentContent,
      });
    }
  }

  const payload = {
    user_id: userId,
    session_id: sessionId,
    messages: parsedMessages,
    time: Math.floor(Date.now() / 1000), // Existing backend validation requirement
    chat: chatPairs,                     // Existing backend validation requirement
  };

  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/chat/sync-messages`;

  console.log(`Syncing ${parsedMessages.length} messages to backend for user ${userId} (session: ${sessionId}) to ${backendUrl}...`);

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`Successfully synced chat messages for user ${userId} to backend.`);
      // Clear Redis keys on successful sync
      await redis.del(messagesKey);
      await redis.srem('active_users', userId);
      await redis.del(`chat:user:${userId}:last_activity`);
    } else {
      const statusText = await response.text();
      if (response.status === 404 || response.status === 400) {
        console.warn(`Permanent error (${response.status}) syncing for user ${userId}. Cleaning up Redis keys to prevent infinite retries.`);
        await redis.del(messagesKey);
        await redis.srem('active_users', userId);
        await redis.del(`chat:user:${userId}:last_activity`);
      } else {
        throw new Error(`Backend responded with status ${response.status}: ${statusText}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to sync chat messages to backend for user ${userId}:`, err.message);
    // Keep data intact for retry in the next cycle for transient errors
  }
}
