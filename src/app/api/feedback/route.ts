import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UserFeedback } from '@/lib/types';


export async function POST(req: Request) {
  try {
    const { traceId, feedback } = await req.json();

    if (!traceId || !feedback) {
      return NextResponse.json(
        { error: 'traceId and feedback are required' },
        { status: 400 }
      );
    }

    if (feedback !== 'helpful' && feedback !== 'not_helpful') {
      return NextResponse.json(
        { error: 'feedback must be "helpful" or "not_helpful"' },
        { status: 400 }
      );
    }

    // Update trace with feedback
    await prisma.trace.update({
      where: { id: traceId },
      data: {
        userFeedback: feedback,
        feedbackTimestamp: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
