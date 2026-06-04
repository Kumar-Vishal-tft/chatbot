import { NextRequest, NextResponse } from 'next/server';
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, input, output, model, sessionId, userId, usageMetadata } = body;

    const trace = langfuse.trace({
      name: name || 'chat-interaction',
      userId: userId || 'anonymous',
      sessionId: sessionId || undefined,
    });

    const generation = trace.generation({
      name: 'gemini-generation',
      model: model || 'gemini-2.5-flash',
      input: input,
      output: output,
    });

    if (usageMetadata) {
      generation.update({
        usage: {
          promptTokens: usageMetadata.promptTokenCount,
          completionTokens: usageMetadata.candidatesTokenCount,
          totalTokens: usageMetadata.totalTokenCount,
        }
      });
    }

    await langfuse.flushAsync();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Langfuse tracing proxy error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
