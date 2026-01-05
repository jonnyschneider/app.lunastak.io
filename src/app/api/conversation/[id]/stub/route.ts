import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/conversation/[id]/stub
 *
 * Fetch conversation data for development stubbing.
 * Returns the latest trace's extractedContext and output for UI iteration.
 *
 * Usage: Add ?stub=conversationId to page URL to skip conversation flow
 * and load directly into extraction or strategy view.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Conversation ID is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch conversation with its latest trace
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        traces: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const latestTrace = conversation.traces[0];

    if (!latestTrace) {
      return NextResponse.json(
        { error: 'No traces found for this conversation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversationId: conversation.id,
      experimentVariant: conversation.experimentVariant,
      traceId: latestTrace.id,
      extractedContext: latestTrace.extractedContext,
      dimensionalCoverage: latestTrace.dimensionalCoverage,
      strategy: latestTrace.output,
      thoughts: latestTrace.claudeThoughts,
    });
  } catch (error) {
    console.error('[Stub API] Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation data' },
      { status: 500 }
    );
  }
}
