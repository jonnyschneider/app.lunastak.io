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
          content: `In a business strategy context, someone has said "${priority}" is their top priority. What's the legitimate trade-off they're implicitly deprioritizing?

The deprioritized side must be something a well-run company would credibly choose — a real virtue, not a pejorative or obvious bad. Principles capture "good vs good" trade-offs, not "good vs bad."

Examples of well-formed pairs:
- Priority: Ubiquity → Deprioritized: Premium pricing
- Priority: Curation → Deprioritized: Selection
- Priority: Investing in people → Deprioritized: Minimising labour costs
- Priority: Pure-play trust → Deprioritized: Vertical integration
- Priority: Scarcity → Deprioritized: Volume growth

Avoid pejorative framings like "trend-following", "easy revenue", "over-production", "cutting corners" — these collapse the trade-off into a false choice every reader can already identify.

Reply with ONLY the deprioritized side (2-4 words, no explanation).`,
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
