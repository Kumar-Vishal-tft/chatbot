import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'bastard',
  'whore', 'slut', 'cunt', 'fag', 'nigger', 'retard', 'wanker',
  'motherfucker', 'cocksucker',
];

function hasAbusiveContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lower);
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const blockKey = `abuse:blocked:${sessionId}`;
    const isBlocked = await redis.get(blockKey);

    if (isBlocked) {
      const ttl = await redis.ttl(blockKey);
      return NextResponse.json({
        blocked: true,
        reason: isBlocked,
        remainingSeconds: ttl > 0 ? ttl : 0,
      });
    }

    return NextResponse.json({
      blocked: false,
      reason: null,
      remainingSeconds: 0,
    });
  } catch (error: any) {
    console.error('Abuse check GET error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const blockKey = `abuse:blocked:${sessionId}`;
    const countKey = `abuse:count:${sessionId}`;

    // 1. Check if already blocked
    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
      const ttl = await redis.ttl(blockKey);
      return NextResponse.json({
        abusive: isBlocked === 'abuse',
        repetition: isBlocked === 'repetition',
        count: 3,
        blocked: true,
        remainingSeconds: ttl > 0 ? ttl : 0,
      });
    }

    // 2. Check for abusive language
    const abusive = hasAbusiveContent(message);

    // 3. Check for message repetition
    const lastMsgKey = `repetition:last:${sessionId}`;
    const repCountKey = `repetition:count:${sessionId}`;

    const lastMessage = await redis.get(lastMsgKey);
    const currentNormalized = message.trim().toLowerCase();
    const lastNormalized = lastMessage ? lastMessage.trim().toLowerCase() : null;

    let isRepetitive = false;
    let newRepCount = 0;

    if (lastNormalized === currentNormalized) {
      newRepCount = await redis.incr(repCountKey);
      await redis.expire(repCountKey, 86400);
      isRepetitive = true;
    } else {
      await redis.set(lastMsgKey, message);
      await redis.expire(lastMsgKey, 86400);
      await redis.set(repCountKey, 1);
      await redis.expire(repCountKey, 86400);
      newRepCount = 1;
    }

    if (abusive) {
      // Increment abuse counter in Redis
      const newCount = await redis.incr(countKey);
      
      // Expire counter after 24 hours if not blocked yet
      await redis.expire(countKey, 86400);

      console.warn(`[ABUSE DETECTED] Session: ${sessionId} | Attempt: ${newCount}/3 | Message: "${message}"`);

      if (newCount >= 3) {
        // Set block status for 15 minutes (900 seconds)
        await redis.set(blockKey, 'abuse', 'EX', 900);
        // Clear counts once blocked to reset state after lock expires
        await redis.del(countKey);
        await redis.del(repCountKey);
        await redis.del(lastMsgKey);

        console.error(`[USER BLOCKED] Session: ${sessionId} has been blocked for 15 minutes due to 3 abuse violations.`);

        return NextResponse.json({
          abusive: true,
          count: 3,
          blocked: true,
          remainingSeconds: 900,
        });
      }

      return NextResponse.json({
        abusive: true,
        count: newCount,
        blocked: false,
        remainingSeconds: 0,
      });
    }

    if (isRepetitive && newRepCount >= 4) {
      // Set block status for 15 minutes (900 seconds)
      await redis.set(blockKey, 'repetition', 'EX', 900);
      // Clear counts once blocked
      await redis.del(countKey);
      await redis.del(repCountKey);
      await redis.del(lastMsgKey);

      console.error(`[USER BLOCKED] Session: ${sessionId} has been blocked for 15 minutes due to 4 repetition violations.`);

      return NextResponse.json({
        abusive: false,
        repetition: true,
        count: 4,
        blocked: true,
        remainingSeconds: 900,
      });
    }

    if (isRepetitive && newRepCount === 3) {
      return NextResponse.json({
        abusive: false,
        repetition: true,
        count: 3,
        blocked: false,
        remainingSeconds: 0,
      });
    }

    return NextResponse.json({
      abusive: false,
      repetition: false,
      count: 0,
      blocked: false,
      remainingSeconds: 0,
    });
  } catch (error: any) {
    console.error('Abuse check POST error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 });
  }
}
