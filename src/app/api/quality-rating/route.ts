import { NextResponse } from 'next/server';
import { logQualityRating } from '@/lib/events';
import { logStatsigEvent } from '@/lib/statsig';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { traceId, rating } = await req.json();

    if (!traceId || !rating) {
      return NextResponse.json(
        { error: 'traceId and rating are required' },
        { status: 400 }
      );
    }

    if (rating !== 'good' && rating !== 'bad') {
      return NextResponse.json(
        { error: 'rating must be "good" or "bad"' },
        { status: 400 }
      );
    }

    await logQualityRating(traceId, rating);

    // Log to Statsig for experiment metrics
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: { conversation: true },
    });
    if (trace?.conversation?.userId) {
      await logStatsigEvent(
        trace.conversation.userId,
        'quality_rating',
        rating === 'good' ? 1 : 0,
        { rating, variant: trace.conversation.experimentVariant }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Quality Rating API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save quality rating' },
      { status: 500 }
    );
  }
}
