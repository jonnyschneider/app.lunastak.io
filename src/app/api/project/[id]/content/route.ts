import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
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

async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })
  return !!project
}

/**
 * GET /api/project/[id]/content
 * Fetches all user content for a project
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const content = await prisma.userContent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error fetching user content:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

/**
 * POST /api/project/[id]/content
 * Creates new user content
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { type, content, status, metadata } = body

    if (!type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['opportunity', 'principle'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const userContent = await prisma.userContent.create({
      data: {
        projectId,
        type,
        content,
        status: status || 'draft',
        metadata: metadata || undefined,
      },
    })

    return NextResponse.json({ content: userContent }, { status: 201 })
  } catch (error) {
    console.error('Error creating user content:', error)
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 })
  }
}

/**
 * PUT /api/project/[id]/content
 * Updates existing user content
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { id, content, status, metadata } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
    }

    // Verify content belongs to project
    const existing = await prisma.userContent.findFirst({
      where: { id, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const updated = await prisma.userContent.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(metadata !== undefined && { metadata }),
      },
    })

    return NextResponse.json({ content: updated })
  } catch (error) {
    console.error('Error updating user content:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
}

/**
 * DELETE /api/project/[id]/content
 * Deletes user content
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  if (!(await verifyProjectAccess(projectId, userId))) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('id')

    if (!contentId) {
      return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
    }

    // Verify content belongs to project
    const existing = await prisma.userContent.findFirst({
      where: { id: contentId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    await prisma.userContent.delete({
      where: { id: contentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user content:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
