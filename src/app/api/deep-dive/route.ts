// src/app/api/deep-dive/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUser, requireProjectAccess, isDenied } from '@/lib/auth/guard'
import { validateDeepDiveCreateInput } from '@/lib/contracts/deep-dive'

/**
 * POST /api/deep-dive
 * Creates a new deep dive
 */
export async function POST(request: Request) {
  // The requester first, so an anonymous call is a 401 before the body or query is looked at.
  const requester = await requireUser()
  if (isDenied(requester)) return requester

  try {
    const body = await request.json()

    if (!validateDeepDiveCreateInput(body)) {
      return NextResponse.json(
        { error: 'Invalid input: projectId and topic are required' },
        { status: 400 }
      )
    }

    const { projectId, topic, notes, origin } = body

    // The project arrives in the request, so it goes through the guard: owner only, and an
    // archived project is as not-found as someone else's.
    const auth = await requireProjectAccess(projectId, { as: requester })
    if (isDenied(auth)) return auth
    if (auth.project.status !== 'active') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create the deep dive
    const deepDive = await prisma.deepDive.create({
      data: {
        projectId,
        topic,
        notes: notes || null,
        status: 'active',
        origin: origin || 'manual',
      },
    })

    return NextResponse.json({
      id: deepDive.id,
      projectId: deepDive.projectId,
      topic: deepDive.topic,
      notes: deepDive.notes,
      status: deepDive.status,
      origin: deepDive.origin,
      resolvedAt: deepDive.resolvedAt?.toISOString() || null,
      createdAt: deepDive.createdAt.toISOString(),
      updatedAt: deepDive.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error creating deep dive:', error)
    return NextResponse.json({ error: 'Failed to create deep dive' }, { status: 500 })
  }
}

/**
 * GET /api/deep-dive
 * Lists deep dives for a project
 */
export async function GET(request: Request) {
  // The requester first, so an anonymous call is a 401 before the body or query is looked at.
  const requester = await requireUser()
  if (isDenied(requester)) return requester

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const includeResolved = searchParams.get('includeResolved') === 'true'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // The project arrives in the request, so it goes through the guard: owner only, and an
    // archived project is as not-found as someone else's.
    const auth = await requireProjectAccess(projectId, { as: requester })
    if (isDenied(auth)) return auth
    if (auth.project.status !== 'active') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch deep dives with conversation and document counts
    const deepDives = await prisma.deepDive.findMany({
      where: {
        projectId,
        ...(includeResolved ? {} : { status: { not: 'resolved' } }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        conversations: {
          select: { id: true, updatedAt: true },
          where: { status: { not: 'abandoned' } },
        },
        documents: {
          select: { id: true, updatedAt: true },
        },
      },
    })

    // Format response with counts and last activity
    const formattedDeepDives = deepDives.map(dd => {
      // Calculate last activity from conversations and documents
      const conversationDates = dd.conversations.map(c => c.updatedAt)
      const documentDates = dd.documents.map(d => d.updatedAt)
      const allDates = [...conversationDates, ...documentDates, dd.updatedAt]
      const lastActivityAt = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()))).toISOString()
        : dd.updatedAt.toISOString()

      return {
        id: dd.id,
        projectId: dd.projectId,
        topic: dd.topic,
        notes: dd.notes,
        status: dd.status,
        origin: dd.origin,
        resolvedAt: dd.resolvedAt?.toISOString() || null,
        createdAt: dd.createdAt.toISOString(),
        updatedAt: dd.updatedAt.toISOString(),
        conversationCount: dd.conversations.length,
        documentCount: dd.documents.length,
        lastActivityAt,
      }
    })

    return NextResponse.json({ deepDives: formattedDeepDives })
  } catch (error) {
    console.error('Error fetching deep dives:', error)
    return NextResponse.json({ error: 'Failed to fetch deep dives' }, { status: 500 })
  }
}
