import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return session.user.id

  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
  if (guestCookie?.value) {
    const guestUser = await prisma.user.findUnique({
      where: { id: guestCookie.value },
      select: { email: true },
    })
    if (guestUser && isGuestUser(guestUser.email)) {
      return guestCookie.value
    }
  }
  return null
}

/**
 * GET /api/project/[id]/strategy
 * Returns the latest starred trace ID for redirect, or null if no strategy exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // Fetch project basic info
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { fragments: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Find the latest starred trace for this project's conversations
    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      select: { id: true },
    })

    let latestTraceId: string | null = null

    if (conversations.length > 0) {
      const starredTrace = await prisma.trace.findFirst({
        where: {
          conversationId: { in: conversations.map(c => c.id) },
          starred: true,
        },
        orderBy: { timestamp: 'desc' },
        select: { id: true },
      })

      latestTraceId = starredTrace?.id || null
    }

    return NextResponse.json({
      latestTraceId,
      projectName: project.name,
      thinkingCount: project._count.fragments,
    })
  } catch (error) {
    console.error('Error fetching project strategy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch strategy' },
      { status: 500 }
    )
  }
}
