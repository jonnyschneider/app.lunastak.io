import { NextRequest, NextResponse } from 'next/server';
import { createMessage } from '@/lib/claude';
import { extractText } from '@/lib/extract-text';
import { requireUser, isDenied } from '@/lib/auth/guard';

/** The one free-text field that reaches the prompt — a principle's priority is a few words. */
const MAX_PRIORITY_LENGTH = 200;

export async function POST(request: NextRequest) {
  // Guests allowed: PrinciplesSection is on the guest-reachable template page. Deliberately not
  // metered — no userId goes to createMessage, so the guest quota is untouched (auth-gap plan D4).
  const requester = await requireUser();
  if (isDenied(requester)) return requester;

  try {
    const { priority } = await request.json();

    if (!priority || typeof priority !== 'string') {
      return NextResponse.json({ error: 'Priority is required' }, { status: 400 });
    }
    if (priority.length > MAX_PRIORITY_LENGTH) {
      return NextResponse.json({ error: `Priority must be ${MAX_PRIORITY_LENGTH} characters or fewer` }, { status: 400 });
    }

    const message = await createMessage({
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

    const opposite = extractText(message).trim();

    return NextResponse.json({ opposite });
  } catch (error) {
    console.error('Failed to suggest opposite:', error);
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
