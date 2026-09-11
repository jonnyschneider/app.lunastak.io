import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'
import { createComponent, updateComponent, deleteComponent } from '@/lib/decision-stack'

// Reading honours demo projects; writing is the owner's alone — a write that honoured `isDemo`
// would let any guest edit a showcase project's opportunities and principles (it did, until
// 2026-09-11). Archived projects are not found either way (`active: true`).

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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId, { access: 'read', active: true })
  if (isDenied(auth)) return auth

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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId, { active: true })
  if (isDenied(auth)) return auth

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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId, { active: true })
  if (isDenied(auth)) return auth

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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId, { active: true })
  if (isDenied(auth)) return auth

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
