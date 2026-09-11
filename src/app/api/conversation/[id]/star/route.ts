import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireConversationAccess, isDenied } from '@/lib/auth/guard'

/**
 * POST /api/conversation/[id]/star
 * Toggle the starred status of a conversation by starring its first trace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params

    // Starring is a write: owner only, never via a demo project.
    const auth = await requireConversationAccess(conversationId)
    if (isDenied(auth)) return auth

    const latestTrace = await prisma.trace.findFirst({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
    })

    if (!latestTrace) {
      return NextResponse.json(
        { error: 'Conversation has no strategy output to star' },
        { status: 400 }
      )
    }

    const newStarredStatus = !latestTrace.starred

    // Update the trace's starred status
    await prisma.trace.update({
      where: { id: latestTrace.id },
      data: {
        starred: newStarredStatus,
        starredAt: newStarredStatus ? new Date() : null,
      },
    })

    return NextResponse.json({
      starred: newStarredStatus,
      starredAt: newStarredStatus ? new Date().toISOString() : null,
    })
  } catch (error) {
    console.error('Failed to toggle conversation star:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
