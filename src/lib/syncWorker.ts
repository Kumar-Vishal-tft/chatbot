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
  // 1. Fetch all users from active_users_zset registry
  const activeUsers = await redis.zrange('active_users_zset', 0, -1);
  if (activeUsers.length === 0) {
    return;
  }

  console.log(`Background Sync Worker: Checking activity status for ${activeUsers.length} users...`);

  for (const userId of activeUsers) {
    try {
      const messagesKey = `chat:user:${userId}:messages`;
      const activeFlagKey = `chat:user:${userId}:active`;

      // 2. Check the two sync triggers:
      // a) Inactivity (active flag expired after 15m)
      const isActive = await redis.exists(activeFlagKey);
      const isInactive = isActive === 0;

      // b) Message count threshold reached (>= 50 messages)
      const messageCount = await redis.llen(messagesKey);
      const reachedCountThreshold = messageCount >= 50;

      if (isInactive || reachedCountThreshold) {
        const triggerReason = isInactive ? '15m inactivity' : `message count threshold (${messageCount}/50)`;
        console.log(`User ${userId} satisfies sync condition: ${triggerReason}. Initiating sync...`);

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

function toValidUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function syncUserMessages(userId: string) {
  const messagesKey = `chat:user:${userId}:messages`;
  const rawMessages = await redis.lrange(messagesKey, 0, -1);

  if (rawMessages.length === 0) {
    // No messages to sync, clean up registry
    console.log(`No messages found for user ${userId}. Cleaning up registry...`);
    await redis.zrem('active_users_zset', userId);
    await redis.del(`chat:user:${userId}:last_activity`);
    await redis.del(`chat:user:${userId}:is_existing_patient`);
    return;
  }

  // Fetch patient status flag (existing patient vs guest/new user)
  const isExistingRaw = await redis.get(`chat:user:${userId}:is_existing_patient`);
  const isExistingPatient = isExistingRaw === 'true';

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

  // Sanitize sessionId to ensure it is a valid UUID format
  sessionId = toValidUUID(sessionId);

  // Construct backward-compatible chat pairs (used for both existing sync and guest lead sync)
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

  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  let backendUrl = '';
  let payload: any = {};

  if (isExistingPatient) {
    // Standard sync for existing patients
    backendUrl = `${baseUrl.replace(/\/$/, '')}/chat/sync-messages`;
    payload = {
      user_id: userId,
      session_id: sessionId,
      messages: parsedMessages,
      time: Math.floor(Date.now() / 1000),
      chat: chatPairs,
    };
  } else {
    // Lead session sync for new/guest users
    backendUrl = `${baseUrl.replace(/\/$/, '')}/leads/${sessionId}/session`;
    payload = {
      history: chatPairs,
    };
  }

  console.log(`Syncing ${parsedMessages.length} messages (type: ${isExistingPatient ? 'existing' : 'lead'}) to backend for user ${userId} to ${backendUrl}...`);

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
      await redis.zrem('active_users_zset', userId);
      await redis.del(`chat:user:${userId}:last_activity`);
      await redis.del(`chat:user:${userId}:is_existing_patient`);
      await redis.del(`chat:user:${userId}:lead_data`);
    } else {
      const statusText = await response.text();
      if (response.status === 404 || response.status === 400 || response.status === 422) {
        console.warn(`Permanent error (${response.status}) syncing for user ${userId}. Cleaning up Redis keys to prevent infinite retries.`);
        await redis.del(messagesKey);
        await redis.zrem('active_users_zset', userId);
        await redis.del(`chat:user:${userId}:last_activity`);
        await redis.del(`chat:user:${userId}:is_existing_patient`);
        await redis.del(`chat:user:${userId}:lead_data`);
      } else {
        throw new Error(`Backend responded with status ${response.status}: ${statusText}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to sync chat messages to backend for user ${userId}:`, err.message);
    // Keep data intact for retry in the next cycle for transient errors
  }
}
