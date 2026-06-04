import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const data = await redis.get(`session:${sessionId}`);

    if (!data) {
      return NextResponse.json({
        success: true,
        message: 'No session found in Redis database',
        sessions: [],
        messages: {}
      });
    }

    const { sessions, messages } = JSON.parse(data);
    return NextResponse.json({
      success: true,
      message: 'Session successfully retrieved from Redis',
      sessions,
      messages
    });
  } catch (error: any) {
    console.error('Redis load session error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session from Redis', detail: error.message },
      { status: 500 }
    );
  }
}
