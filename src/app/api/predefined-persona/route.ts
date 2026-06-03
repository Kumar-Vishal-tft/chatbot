import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'default';

  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/predefined-persona?name=${encodeURIComponent(name)}`;

  try {
    console.log('Fetching predefined persona from backend:', backendUrl);
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Predefined persona backend returned status:', response.status);
      return NextResponse.json(
        { detail: `Failed to fetch predefined persona for: ${name}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('predefined-persona proxy error:', error);
    return NextResponse.json(
      { detail: 'We are having trouble loading the campaign role from the backend.' },
      { status: 500 }
    );
  }
}
