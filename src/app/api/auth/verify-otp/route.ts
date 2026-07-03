import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes in seconds

export async function POST(request: NextRequest) {
  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/auth/verify-otp`;

  try {
    const body = await request.json();
    const phone = body.phone_number ? body.phone_number.toString().trim() : '';

    if (phone) {
      const lockoutKey = `otp_lockout:${phone}`;
      const isLocked = await redis.get(lockoutKey);
      if (isLocked) {
        return NextResponse.json(
          { detail: 'Too many attempts, please try again later' },
          { status: 429 }
        );
      }
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('verify-otp backend response not JSON:', text);
        data = { detail: text };
      }
    }

    if (response.ok) {
      if (phone) {
        const attemptsKey = `otp_attempts:${phone}`;
        await redis.del(attemptsKey);
      }
      return NextResponse.json(data, { status: response.status });
    } else {
      if (phone) {
        const attemptsKey = `otp_attempts:${phone}`;
        const lockoutKey = `otp_lockout:${phone}`;
        const currentAttempts = await redis.incr(attemptsKey);
        
        if (currentAttempts === 1) {
          await redis.expire(attemptsKey, 3600); // 1 hour window
        }

        if (currentAttempts >= MAX_ATTEMPTS) {
          await redis.set(lockoutKey, 'locked', 'EX', LOCKOUT_DURATION);
          await redis.del(attemptsKey);
          return NextResponse.json(
            { detail: 'Too many attempts, please try again later' },
            { status: 429 }
          );
        }
      }
      return NextResponse.json(data, { status: response.status });
    }
  } catch (error: any) {
    console.error('verify-otp proxy error:', error);
    return NextResponse.json(
      { detail: 'We are having trouble connecting to the secure registry. Please try again in a moment.' },
      { status: 500 }
    );
  }
}

