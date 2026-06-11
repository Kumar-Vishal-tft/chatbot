import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    const text = await response.text();
    let data = {};
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Chat messages backend response not JSON:', text);
        data = { detail: text };
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('chat messages proxy error:', error);
    return NextResponse.json(
      { detail: 'We are having trouble retrieving your conversation history.' },
      { status: 500 }
    );
  }
}
