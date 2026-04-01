import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { createComponent, updateComponent, deleteComponent } from '@/lib/decision-stack'

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
    where: {
      id: projectId,
      status: 'active',
      OR: [
        { userId },
        { isDemo: true },
      ],
    },
    select: { id: true },
  })
  return !!project
}

/**
 * Map a DecisionStackComponent to the UserContent response shape the UI expects.
 */
function componentToUserContent(component: {
  id: string
  componentType: string
  componentId: string
  content: unknown
  status: string
  createdAt: Date
  updatedAt: Date
}) {
  const content = component.content as Record<string, unknown>
  // Extract objectiveIds from content for metadata (matches old UserContent shape)
  const objectiveIds = (content.objectiveIds as string[]) || []

  return {
    id: component.id,
    type: component.componentType,
    content: JSON.stringify(content),
    status: component.status === 'active' ? 'draft' : component.status,
    metadata: objectiveIds.length > 0 ? { objectiveIds } : null,
    createdAt: component.createdAt.toISOString(),
    updatedAt: component.updatedAt.toISOString(),
  }
}

/**
 * GET /api/project/[id]/content
 * Fetches all user content for a project (opportunities + principles)
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
    const stack = await prisma.decisionStack.findUnique({
      where: { projectId },
      select: { id: true },
    })

    if (!stack) {
      return NextResponse.json({ content: [] })
    }

    const components = await prisma.decisionStackComponent.findMany({
      where: {
        decisionStackId: stack.id,
        componentType: { in: ['opportunity', 'principle'] },
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ content: components.map(componentToUserContent) })
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
    const { type, content: contentStr, metadata } = body

    if (!type || !contentStr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['opportunity', 'principle'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Parse the JSON string content and merge metadata
    let parsedContent: Record<string, unknown>
    try {
      parsedContent = JSON.parse(contentStr)
    } catch {
      parsedContent = { raw: contentStr }
    }

    // Merge objectiveIds from metadata into content
    if (metadata?.objectiveIds) {
      parsedContent.objectiveIds = metadata.objectiveIds
    }

    // Generate a stable component ID
    const prefix = type === 'opportunity' ? 'opp' : 'prin'
    const componentId = `${prefix}-${Date.now()}`

    // Ensure content has an id field
    if (!parsedContent.id) {
      parsedContent.id = componentId
    }

    const id = await createComponent(projectId, type, componentId, parsedContent)

    // Fetch the created component to return in the expected shape
    const created = await prisma.decisionStackComponent.findUnique({
      where: { id },
    })

    if (!created) {
      return NextResponse.json({ error: 'Failed to create content' }, { status: 500 })
    }

    return NextResponse.json({ content: componentToUserContent(created) }, { status: 201 })
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
    const { id, content: contentStr, metadata } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
    }

    // Find the component by its DB id
    const existing = await prisma.decisionStackComponent.findFirst({
      where: { id },
      include: { decisionStack: { select: { projectId: true } } },
    })

    if (!existing || existing.decisionStack.projectId !== projectId) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Parse and merge content
    let parsedContent = existing.content as Record<string, unknown>
    if (contentStr !== undefined) {
      try {
        parsedContent = JSON.parse(contentStr)
      } catch {
        parsedContent = { raw: contentStr }
      }
    }

    // Merge objectiveIds from metadata
    if (metadata?.objectiveIds) {
      parsedContent.objectiveIds = metadata.objectiveIds
    }

    await updateComponent(
      projectId,
      existing.componentType,
      existing.componentId,
      parsedContent
    )

    // Fetch updated to return
    const updated = await prisma.decisionStackComponent.findUnique({
      where: { id },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }

    return NextResponse.json({ content: componentToUserContent(updated) })
  } catch (error) {
    console.error('Error updating user content:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }
}

/**
 * DELETE /api/project/[id]/content
 * Deletes user content (soft-delete via archive)
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

    // Find the component by its DB id
    const existing = await prisma.decisionStackComponent.findFirst({
      where: { id: contentId },
      include: { decisionStack: { select: { projectId: true } } },
    })

    if (!existing || existing.decisionStack.projectId !== projectId) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    await deleteComponent(projectId, existing.componentType, existing.componentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user content:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
