import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Direct import of the sync worker process to trigger it programmatically for testing
export async function GET(request: NextRequest) {
  try {
    const testUserId = 'test_user_999';
    const testSessionId = '00000000-0000-0000-0000-000000000999';

    console.log('--- TEST RUN: Redis Chat Sync Batching ---');

    // 1. Clean up any existing test data in Redis
    await redis.del(`chat:user:${testUserId}:messages`);
    await redis.srem('active_users', testUserId);
    await redis.del(`chat:user:${testUserId}:active`);
    await redis.del(`chat:user:${testUserId}:last_activity`);
    await redis.del(`chat:user:${testUserId}:sync_lock`);

    // 2. Call enqueue endpoint internally by simulating the database insertions
    // We'll write a couple of test messages (user message and assistant response)
    const testMessages = [
      {
        role: 'user',
        message: 'Hello, this is a test user message.',
        timestamp: Math.floor(Date.now() / 1000) - 10,
        session_id: testSessionId,
      },
      {
        role: 'assistant',
        message: 'Hello! I am your assistant. How can I help you today?',
        timestamp: Math.floor(Date.now() / 1000) - 5,
        session_id: testSessionId,
      }
    ];

    console.log('[Test] Enqueuing test messages in Redis...');
    for (const msg of testMessages) {
      await redis.rpush(`chat:user:${testUserId}:messages`, JSON.stringify(msg));
    }
    await redis.sadd('active_users', testUserId);
    await redis.set(`chat:user:${testUserId}:active`, 'true', 'EX', 900);
    await redis.set(`chat:user:${testUserId}:last_activity`, Math.floor(Date.now() / 1000).toString());

    // Verify keys exist in Redis
    const initialMessages = await redis.lrange(`chat:user:${testUserId}:messages`, 0, -1);
    const initialIsActive = await redis.exists(`chat:user:${testUserId}:active`);
    const initialInRegistry = await redis.sismember('active_users', testUserId);

    console.log('[Test] Redis Initial State:', {
      messagesCount: initialMessages.length,
      isActiveFlagPresent: initialIsActive === 1,
      isInActiveUsersRegistry: initialInRegistry === 1,
    });

    // 3. Simulate 15 minutes of inactivity by deleting the active flag key
    console.log('[Test] Simulating 15 minutes of inactivity (deleting active flag)...');
    await redis.del(`chat:user:${testUserId}:active`);

    // Verify active flag is gone
    const simulatedIsActive = await redis.exists(`chat:user:${testUserId}:active`);

    // 4. Force run the sync worker logic by importing it
    console.log('[Test] Force-triggering background sync worker process...');
    const { startSyncWorker } = await import('@/lib/syncWorker');
    
    // We start the sync worker to make sure it's running, but we also run the check function directly
    // since the worker runs on a setInterval. We can wait a short period to let it run or call it.
    // Let's sleep for 2 seconds to let the interval run, or we can just wait.
    // Wait, the interval is 30 seconds. So instead of waiting 30 seconds, let's call the check logic.
    // To do that, we'll export the process function or just wait for it.
    // Let's write a small helper inside syncWorker or just run it.
    // Actually, we can wait a bit or we can just run the function.
    // Let's call processActiveUsersSync if we export it, or we can just run it.
    // Wait! Let's make processActiveUsersSync exported from syncWorker.ts so we can call it here directly!
    
    // Let's import it:
    const syncWorkerModule = await import('@/lib/syncWorker');
    // We will update syncWorker.ts to export processActiveUsersSync so we can trigger it immediately in tests!
    // Let's call it:
    let syncError = null;
    if ((syncWorkerModule as any).processActiveUsersSync) {
      try {
        await (syncWorkerModule as any).processActiveUsersSync();
      } catch (err: any) {
        syncError = err.message;
      }
    } else {
      console.warn('processActiveUsersSync is not exported.');
    }

    // 5. Verify final state in Redis
    const finalMessages = await redis.lrange(`chat:user:${testUserId}:messages`, 0, -1);
    const finalIsActive = await redis.exists(`chat:user:${testUserId}:active`);
    const finalInRegistry = await redis.sismember('active_users', testUserId);

    console.log('[Test] Redis Final State:', {
      messagesCount: finalMessages.length,
      isActiveFlagPresent: finalIsActive === 1,
      isInActiveUsersRegistry: finalInRegistry === 1,
    });

    return NextResponse.json({
      success: true,
      test_flow: {
        initial: {
          messagesCount: initialMessages.length,
          isActive: initialIsActive === 1,
          inRegistry: initialInRegistry === 1
        },
        simulatedInactivity: {
          isActive: simulatedIsActive === 1
        },
        final: {
          messagesCount: finalMessages.length,
          isActive: finalIsActive === 1,
          inRegistry: finalInRegistry === 1
        },
        syncError
      }
    });

  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
