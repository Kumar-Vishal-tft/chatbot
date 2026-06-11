import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sessions, messages, onboardingStep, onboardingProfile, userName, isVerified } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const payload = JSON.stringify({ 
      sessions, 
      messages,
      onboardingStep,
      onboardingProfile,
      userName,
      isVerified
    });
    
    // Save to Redis and set TTL of 7 days (604800 seconds) for clean lifecycle management
    await redis.set(`session:${sessionId}`, payload, 'EX', 604800);

    return NextResponse.json({ 
      success: true, 
      message: 'Session successfully synchronized with Redis',
      sessionId 
    });
  } catch (error: any) {
    console.error('Redis save session error:', error);
    return NextResponse.json(
      { error: 'Failed to synchronize session to Redis', detail: error.message },
      { status: 500 }
    );
  }
}
