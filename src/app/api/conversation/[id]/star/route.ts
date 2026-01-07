import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/conversation/[id]/star
 * Toggle the starred status of a conversation by starring its first trace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await params

    // Verify the conversation belongs to the user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      include: {
        traces: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (conversation.traces.length === 0) {
      return NextResponse.json(
        { error: 'Conversation has no strategy output to star' },
        { status: 400 }
      )
    }

    const trace = conversation.traces[0]
    const newStarredStatus = !trace.starred

    // Update the trace's starred status
    await prisma.trace.update({
      where: { id: trace.id },
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
