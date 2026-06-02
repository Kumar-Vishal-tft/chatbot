import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/auth/send-otp`;

  
  try {
    const body = await request.json();
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
        console.warn('send-otp backend response not JSON:', text);
        data = { detail: text };
      }
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('send-otp proxy error:', error);
    return NextResponse.json(
      { detail: 'We are having trouble connecting to the secure registry. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
