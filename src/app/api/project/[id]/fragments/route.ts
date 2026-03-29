// src/app/api/project/[id]/fragments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

async function getAuthUserId(): Promise<string | null> {
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
 * GET /api/project/[id]/fragments
 * Returns all fragments for the project with dimension tags.
 * Query params: ?dimension=X&status=active&source=conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params
  const { searchParams } = new URL(request.url)
  const dimensionFilter = searchParams.get('dimension')
  const statusFilter = searchParams.get('status') || 'active'
  const sourceFilter = searchParams.get('source') // 'conversation' | 'document'

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Build where clause
  const where: Record<string, unknown> = { projectId }
  if (statusFilter !== 'all') {
    where.status = statusFilter
  }
  if (sourceFilter === 'conversation') {
    where.conversationId = { not: null }
    where.documentId = null
  } else if (sourceFilter === 'document') {
    where.documentId = { not: null }
  }

  // If filtering by dimension, we need to filter via dimension tags
  if (dimensionFilter) {
    where.dimensionTags = {
      some: { dimension: dimensionFilter },
    }
  }

  const fragments = await prisma.fragment.findMany({
    where,
    include: {
      dimensionTags: {
        select: { dimension: true, confidence: true },
      },
      conversation: {
        select: { id: true, title: true },
      },
      document: {
        select: { id: true, fileName: true },
      },
    },
    orderBy: { capturedAt: 'desc' },
  })

  // Count totals
  const [activeCount, archivedCount] = await Promise.all([
    prisma.fragment.count({ where: { projectId, status: 'active' } }),
    prisma.fragment.count({ where: { projectId, status: 'archived' } }),
  ])

  const result = {
    fragments: fragments.map(f => ({
      id: f.id,
      title: f.title,
      content: f.content,
      contentType: f.contentType,
      status: f.status,
      confidence: f.confidence,
      sourceType: f.sourceType,
      dimensions: f.dimensionTags.map(t => ({
        dimension: t.dimension,
        confidence: t.confidence,
      })),
      source: f.conversation
        ? { type: 'conversation' as const, id: f.conversation.id, name: f.conversation.title || 'Untitled' }
        : f.document
          ? { type: 'document' as const, id: f.document.id, name: f.document.fileName }
          : null,
      capturedAt: f.capturedAt.toISOString(),
    })),
    total: fragments.length,
    activeCount,
    archivedCount,
  }

  return NextResponse.json(result)
}

/**
 * PATCH /api/project/[id]/fragments
 * Update fragment status (archive/restore).
 * Body: { id: string, status: 'archived' | 'active', archivedReason?: string }
 *    or { ids: string[], status: 'archived' | 'active', archivedReason?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = await request.json()
  const { id, ids, status, archivedReason } = body

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!['archived', 'active'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const fragmentIds = ids || (id ? [id] : [])
  if (fragmentIds.length === 0) {
    return NextResponse.json({ error: 'No fragment IDs provided' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'archived') {
    updateData.archivedAt = new Date()
    if (archivedReason) updateData.archivedReason = archivedReason
  } else {
    updateData.archivedAt = null
    updateData.archivedReason = null
  }

  await prisma.fragment.updateMany({
    where: {
      id: { in: fragmentIds },
      projectId,
    },
    data: updateData,
  })

  return NextResponse.json({ success: true, updated: fragmentIds.length })
}
