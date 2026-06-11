import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const testUserId = 'test_user_999';
    const testSessionId = '00000000-0000-0000-0000-000000000999';

    console.log('--- TEST RUN: Redis Chat Sync Batching ---');

    // 1. Clean up any existing test data in Redis
    await redis.del(`chat:user:${testUserId}:messages`);
    await redis.zrem('active_users_zset', testUserId);
    await redis.del(`chat:user:${testUserId}:active`);
    await redis.del(`chat:user:${testUserId}:last_activity`);
    await redis.del(`chat:user:${testUserId}:sync_lock`);
    await redis.del(`chat:user:${testUserId}:is_existing_patient`);
    await redis.del(`chat:user:${testUserId}:lead_data`);

    // 2. Call enqueue endpoint internally by simulating the database insertions
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
    await redis.zadd('active_users_zset', Math.floor(Date.now() / 1000), testUserId);
    await redis.set(`chat:user:${testUserId}:is_existing_patient`, 'true');
    await redis.set(`chat:user:${testUserId}:active`, 'true', 'EX', 900);
    await redis.set(`chat:user:${testUserId}:last_activity`, Math.floor(Date.now() / 1000).toString());

    // Verify keys exist in Redis
    const initialMessages = await redis.lrange(`chat:user:${testUserId}:messages`, 0, -1);
    const initialIsActive = await redis.exists(`chat:user:${testUserId}:active`);
    const initialScore = await redis.zscore('active_users_zset', testUserId);

    console.log('[Test] Redis Initial State:', {
      messagesCount: initialMessages.length,
      isActiveFlagPresent: initialIsActive === 1,
      isInActiveUsersRegistry: initialScore !== null,
    });

    // 3. Simulate 15 minutes of inactivity by deleting the active flag key
    console.log('[Test] Simulating 15 minutes of inactivity (deleting active flag)...');
    await redis.del(`chat:user:${testUserId}:active`);

    // Verify active flag is gone
    const simulatedIsActive = await redis.exists(`chat:user:${testUserId}:active`);

    // 4. Force run the sync worker logic
    console.log('[Test] Force-triggering background sync worker process...');
    const syncWorkerModule = await import('@/lib/syncWorker');
    
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
    const finalScore = await redis.zscore('active_users_zset', testUserId);

    console.log('[Test] Redis Final State:', {
      messagesCount: finalMessages.length,
      isActiveFlagPresent: finalIsActive === 1,
      isInActiveUsersRegistry: finalScore !== null,
    });

    return NextResponse.json({
      success: true,
      test_flow: {
        initial: {
          messagesCount: initialMessages.length,
          isActive: initialIsActive === 1,
          inRegistry: initialScore !== null
        },
        simulatedInactivity: {
          isActive: simulatedIsActive === 1
        },
        final: {
          messagesCount: finalMessages.length,
          isActive: finalIsActive === 1,
          inRegistry: finalScore !== null
        },
        syncError
      }
    });

  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
