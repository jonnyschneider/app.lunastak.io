import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  let userId: string | null = session?.user?.id || null

  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

    if (guestCookie?.value) {
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })

      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  return userId
}

/**
 * POST /api/conversation/[id]/star
 * Toggle the starred status of a conversation by starring its first trace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId()

    if (!userId) {
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
        userId,
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
