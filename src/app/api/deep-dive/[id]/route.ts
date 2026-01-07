// src/app/api/deep-dive/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidDeepDiveStatus } from '@/lib/contracts/deep-dive'

/**
 * GET /api/deep-dive/[id]
 * Get a single deep dive with its conversations and documents
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deepDive = await prisma.deepDive.findFirst({
      where: { id },
      include: {
        project: { select: { userId: true } },
        conversations: {
          where: { status: { not: 'abandoned' } },
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: { select: { id: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!deepDive) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    // Verify user owns the project
    if (deepDive.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      deepDive: {
        id: deepDive.id,
        projectId: deepDive.projectId,
        topic: deepDive.topic,
        notes: deepDive.notes,
        status: deepDive.status,
        origin: deepDive.origin,
        sourceMessageId: deepDive.sourceMessageId,
        sourceDocumentId: deepDive.sourceDocumentId,
        resolvedAt: deepDive.resolvedAt?.toISOString() || null,
        createdAt: deepDive.createdAt.toISOString(),
        updatedAt: deepDive.updatedAt.toISOString(),
      },
      conversations: deepDive.conversations.map(c => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        status: c.status,
        messageCount: c.messages.length,
      })),
      documents: deepDive.documents.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching deep dive:', error)
    return NextResponse.json({ error: 'Failed to fetch deep dive' }, { status: 500 })
  }
}

/**
 * PATCH /api/deep-dive/[id]
 * Update a deep dive (topic, notes, status)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { topic, notes, status } = body

    // Validate status if provided
    if (status !== undefined && !isValidDeepDiveStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.deepDive.findFirst({
      where: { id },
      include: { project: { select: { userId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    if (existing.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (topic !== undefined) updateData.topic = topic
    if (notes !== undefined) updateData.notes = notes || null
    if (status !== undefined) {
      updateData.status = status
      if (status === 'resolved') {
        updateData.resolvedAt = new Date()
      } else if (existing.status === 'resolved' && status !== 'resolved') {
        // Un-resolving
        updateData.resolvedAt = null
      }
    }

    const updated = await prisma.deepDive.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      id: updated.id,
      projectId: updated.projectId,
      topic: updated.topic,
      notes: updated.notes,
      status: updated.status,
      origin: updated.origin,
      sourceMessageId: updated.sourceMessageId,
      sourceDocumentId: updated.sourceDocumentId,
      resolvedAt: updated.resolvedAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error updating deep dive:', error)
    return NextResponse.json({ error: 'Failed to update deep dive' }, { status: 500 })
  }
}

/**
 * DELETE /api/deep-dive/[id]
 * Delete a deep dive (conversations/documents remain, deepDiveId set to null)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Verify ownership
    const existing = await prisma.deepDive.findFirst({
      where: { id },
      include: { project: { select: { userId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })
    }

    if (existing.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the deep dive (onDelete: SetNull will unlink conversations/documents)
    await prisma.deepDive.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deep dive:', error)
    return NextResponse.json({ error: 'Failed to delete deep dive' }, { status: 500 })
  }
}
