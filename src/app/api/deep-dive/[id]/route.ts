// src/app/api/deep-dive/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser, requireProjectAccess, isDenied } from '@/lib/auth/guard'
import type { Requester } from '@/lib/auth/current-user'
import { isValidDeepDiveStatus } from '@/lib/contracts/deep-dive'

const deepDiveNotFound = () => NextResponse.json({ error: 'Deep dive not found' }, { status: 404 })

/**
 * A deep dive is owned through its project, so its project goes through the guard (owner only).
 * A deep dive in someone else's project answers exactly like one that doesn't exist — until
 * 2026-09-11 it was a 401 here, which confirmed the id was real.
 */
async function canAccessDeepDiveProject(requester: Requester, projectId: string): Promise<boolean> {
  return !isDenied(await requireProjectAccess(projectId, { as: requester }))
}

/**
 * GET /api/deep-dive/[id]
 * Get a single deep dive with its conversations and documents
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await requireUser()
  const { id } = await params
  if (isDenied(requester)) return requester

  try {
    const deepDive = await prisma.deepDive.findFirst({
      where: { id },
      include: {
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

    if (!deepDive || !(await canAccessDeepDiveProject(requester, deepDive.projectId))) {
      return deepDiveNotFound()
    }

    return NextResponse.json({
      deepDive: {
        id: deepDive.id,
        projectId: deepDive.projectId,
        topic: deepDive.topic,
        notes: deepDive.notes,
        status: deepDive.status,
        origin: deepDive.origin,
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
  const requester = await requireUser()
  const { id } = await params
  if (isDenied(requester)) return requester

  try {
    const body = await request.json()
    const { topic, notes, status } = body

    // Validate status if provided
    if (status !== undefined && !isValidDeepDiveStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existing = await prisma.deepDive.findFirst({ where: { id } })
    if (!existing || !(await canAccessDeepDiveProject(requester, existing.projectId))) {
      return deepDiveNotFound()
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
  const requester = await requireUser()
  const { id } = await params
  if (isDenied(requester)) return requester

  try {
    const existing = await prisma.deepDive.findFirst({ where: { id } })
    if (!existing || !(await canAccessDeepDiveProject(requester, existing.projectId))) {
      return deepDiveNotFound()
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
