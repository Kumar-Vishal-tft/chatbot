import { NextRequest, NextResponse } from 'next/server';
import { toValidUUID } from '@/store/utils';

export async function POST(request: NextRequest) {
  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  try {
    const { sessionId, date, time } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const validUUID = toValidUUID(sessionId);
    const backendUrl = `${baseUrl.replace(/\/$/, '')}/leads/${validUUID}/schedule`;

    console.log('Forwarding schedule request data to backend:', backendUrl, { date, time });

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({ date, time }),
    });

    const text = await response.text();
    let data = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Schedule backend response not JSON:', text);
        data = { detail: text };
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('schedule proxy error:', error);
    return NextResponse.json(
      { detail: 'We are having trouble saving your schedule request.' },
      { status: 500 }
    );
  }
}

