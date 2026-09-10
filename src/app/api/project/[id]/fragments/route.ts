// src/app/api/project/[id]/fragments/route.ts
import { reviewBatchKey } from '@/lib/navigation/review-batch'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'

/**
 * GET /api/project/[id]/fragments
 * Returns all fragments for the project with dimension tags.
 * Query params: ?dimension=X&status=active&source=conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  // Own projects + demos; an archived project is not found.
  const auth = await requireProjectAccess(projectId, { access: 'read' })
  if (isDenied(auth)) return auth
  if (auth.project.status !== 'active') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const dimensionFilter = searchParams.get('dimension')
  const statusFilter = searchParams.get('status') || 'active'
  const sourceFilter = searchParams.get('source') // 'conversation' | 'document'

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
      evidence: {
        select: { text: true, verification: true, sourceRole: true, ordinal: true },
        orderBy: { ordinal: 'asc' },
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
      /*
       * Which ingest this arrived in. The per-ingest review (2026-09-10) filters on it: after an
       * upload or an import, the user is shown what was drawn from THAT, not the whole project.
       * Chats too, since later on 2026-09-10 (see `review-batch.ts`). Manual entries are no batch.
       */
      reviewBatch: f.documentId
        ? reviewBatchKey('document', f.documentId)
        : f.sourceType === 'import' && f.importBatchId
          ? reviewBatchKey('bundle', f.importBatchId)
          : f.conversationId
            ? reviewBatchKey('conversation', f.conversationId)
            : null,
      source: f.conversation
        ? { type: 'conversation' as const, id: f.conversation.id, name: f.conversation.title || 'Untitled' }
        : f.document
          ? { type: 'document' as const, id: f.document.id, name: f.document.fileName }
          : null,
      capturedAt: f.capturedAt.toISOString(),
      // Ground-truth facts, deliberately unshaped: no tranches, scores, grouping or
      // "best span" flattening — the client composes whatever view it needs.
      interpretationType: f.interpretationType,
      reviewedAt: f.reviewedAt ? f.reviewedAt.toISOString() : null,
      // Sorted here as well as in the query so ordinal order is a property of the
      // response rather than of the query that happened to produce it.
      evidence: [...(f.evidence ?? [])].sort((a, b) => a.ordinal - b.ordinal).map(e => ({
        text: e.text,
        verification: e.verification,
        sourceRole: e.sourceRole,
        ordinal: e.ordinal,
      })),
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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId)
  if (isDenied(auth)) return auth
  if (auth.project.status !== 'active') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { id, ids, status, archivedReason, reviewed } = body

  /**
   * `{ ids, reviewed: true }` stamps `reviewedAt` without touching status.
   *
   * `Fragment.reviewedAt` shipped with the Evidence layer and nothing wrote it. It is what
   * separates *reviewed and kept* from *never seen* (design §5) — the middle of the three
   * engagement states, and the one a fragment cannot report for itself.
   *
   * It lives on this route rather than a second endpoint for the same reason a drop IS an archive:
   * one control for what happens to a fragment. And it is written for everything the review PUT ON
   * SCREEN, not everything clicked — a user who skims and is satisfied has reviewed. That was
   * decided against real data, after a click-counted version scored a satisfied skimmer at zero.
   */
  if (reviewed) {
    const reviewIds: string[] = ids || (id ? [id] : [])
    if (reviewIds.length === 0) {
      return NextResponse.json({ error: 'No fragment IDs provided' }, { status: 400 })
    }
    const { count } = await prisma.fragment.updateMany({
      where: { id: { in: reviewIds }, projectId },
      data: { reviewedAt: new Date() },
    })
    return NextResponse.json({ success: true, reviewed: count })
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
