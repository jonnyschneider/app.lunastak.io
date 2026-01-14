import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions';

/**
 * Universal extraction summary endpoint.
 * Returns the fragments extracted from a conversation along with dimensional analysis.
 *
 * Designed for reuse across:
 * - ChatSheet post-extraction summary
 * - Future: Dedicated conversation detail pages
 * - Future: Project knowledge overview
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  if (!conversationId) {
    return NextResponse.json(
      { error: 'conversationId is required' },
      { status: 400 }
    );
  }

  // Get conversation with basic info
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      title: true,
      status: true,
      projectId: true,
      createdAt: true,
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  // Get fragments created from this conversation
  const fragments = await prisma.fragment.findMany({
    where: {
      conversationId: conversationId,
      status: 'active',
    },
    include: {
      dimensionTags: {
        select: {
          dimension: true,
          confidence: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group fragments by dimension for summary
  const dimensionGroups: Record<string, {
    dimension: Tier1Dimension;
    displayName: string;
    fragments: typeof fragments;
  }> = {};

  for (const fragment of fragments) {
    for (const tag of fragment.dimensionTags) {
      const dimension = tag.dimension as Tier1Dimension;
      if (!dimensionGroups[dimension]) {
        const context = DIMENSION_CONTEXT[dimension];
        dimensionGroups[dimension] = {
          dimension,
          displayName: context?.name || dimension,
          fragments: [],
        };
      }
      dimensionGroups[dimension].fragments.push(fragment);
    }
  }

  // Build summary stats
  const dimensionsCovered = Object.keys(dimensionGroups).length;
  const totalFragments = fragments.length;

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      projectId: conversation.projectId,
      createdAt: conversation.createdAt,
    },
    summary: {
      totalFragments,
      dimensionsCovered,
      dimensions: Object.values(dimensionGroups).map(group => ({
        dimension: group.dimension,
        displayName: group.displayName,
        fragmentCount: group.fragments.length,
      })),
    },
    fragments: fragments.map(f => ({
      id: f.id,
      content: f.content,
      contentType: f.contentType,
      confidence: f.confidence,
      dimensions: f.dimensionTags.map(t => t.dimension),
    })),
  });
}
