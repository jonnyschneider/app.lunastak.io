import { NextRequest, NextResponse } from 'next/server';
import { createMessage } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const { priority } = await request.json();

    if (!priority || typeof priority !== 'string') {
      return NextResponse.json({ error: 'Priority is required' }, { status: 400 });
    }

    const message = await createMessage({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `In a business strategy context, someone has said "${priority}" is their top priority. What's the mutually exclusive opposite they're implicitly deprioritizing? Reply with ONLY the opposite (2-4 words, no explanation).`,
        },
      ],
    }, 'suggest_opposite');

    const textBlock = message.content.find((block) => block.type === 'text');
    const opposite = textBlock?.type === 'text' ? textBlock.text.trim() : '';

    return NextResponse.json({ opposite });
  } catch (error) {
    console.error('Failed to suggest opposite:', error);
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
