import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user_id, session_id, role, message, timestamp } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }
    if (!role || (role !== 'user' && role !== 'assistant')) {
      return NextResponse.json({ error: 'role must be user or assistant' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const msgTimestamp = timestamp || Math.floor(Date.now() / 1000);

    const messageData = {
      role,
      message,
      timestamp: msgTimestamp,
      session_id, // stored in list item to retrieve easily
    };

    // 1. Store message in Redis list
    const messagesKey = `chat:user:${user_id}:messages`;
    await redis.rpush(messagesKey, JSON.stringify(messageData));

    // 2. Add user to active_users set
    await redis.sadd('active_users', user_id);

    // 3. Set/refresh the user activity flag (15 minutes = 900 seconds)
    const activeFlagKey = `chat:user:${user_id}:active`;
    await redis.set(activeFlagKey, 'true', 'EX', 900);

    // 4. Update the user's last activity timestamp
    const lastActivityKey = `chat:user:${user_id}:last_activity`;
    await redis.set(lastActivityKey, msgTimestamp.toString());

    return NextResponse.json({
      success: true,
      message: 'Message successfully enqueued in Redis',
      user_id,
      session_id,
    });
  } catch (error: any) {
    console.error('Redis enqueue message error:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue message to Redis', detail: error.message },
      { status: 500 }
    );
  }
}
