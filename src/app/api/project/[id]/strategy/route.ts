import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'

/**
 * GET /api/project/[id]/strategy
 * Returns the latest starred trace ID for redirect, or null if no strategy exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId)
  if (isDenied(auth)) return auth

  try {
    // Fetch project basic info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
