import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/project/[id]
 * Fetches a specific project's data including stats, conversations, and documents
 * Supports both authenticated users and guests (via cookie)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id: projectId } = await params

  // Determine user ID from session or guest cookie
  let userId: string | null = session?.user?.id || null

  if (!userId) {
    // Check for guest cookie
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

    if (guestCookie?.value) {
      // Validate it's a real guest user
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })

      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the project with related data
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: userId,
        status: 'active',
      },
      include: {
        conversations: {
          where: { status: { not: 'abandoned' } },
          orderBy: { createdAt: 'desc' },
          take: 20, // Fetch more to ensure we have enough after filtering
          include: {
            messages: { select: { id: true } },
            fragments: { where: { status: 'active' }, select: { id: true } },
            traces: {
              where: { starred: true },
              select: { starred: true, starredAt: true },
              take: 1,
            },
          },
        },
        fragments: {
          where: { status: 'active' },
          include: {
            dimensionTags: true,
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            fragments: { where: { status: 'active' }, select: { id: true } },
          },
        },
        deepDives: {
          where: { status: { not: 'resolved' } },
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
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch traces (generated strategies) for this project's conversations
    const conversationIds = project.conversations.map(c => c.id)
    const traces = await prisma.trace.findMany({
      where: {
        conversationId: { in: conversationIds },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        id: true,
        timestamp: true,
        conversationId: true,
      },
    })

    // Fetch dimensional syntheses for Areas of Focus
    const dimensionalSyntheses = await prisma.dimensionalSynthesis.findMany({
      where: { projectId },
      select: {
        dimension: true,
        summary: true,
        keyThemes: true,
        gaps: true,
        confidence: true,
        fragmentCount: true,
      },
    })

    // Calculate dimensional coverage
    const dimensionalCoverage: Record<string, { fragmentCount: number; averageConfidence: number }> = {}

    for (const dimension of TIER_1_DIMENSIONS) {
      const dimensionFragments = project.fragments.filter(f =>
        f.dimensionTags.some(t => t.dimension === dimension)
      )

      // Calculate average confidence
      let totalConfidence = 0
      let confidenceCount = 0

      for (const fragment of dimensionFragments) {
        const tag = fragment.dimensionTags.find(t => t.dimension === dimension)
        if (tag?.confidence) {
          const confValue = tag.confidence === 'HIGH' ? 3 : tag.confidence === 'MEDIUM' ? 2 : 1
          totalConfidence += confValue
          confidenceCount++
        }
      }

      dimensionalCoverage[dimension] = {
        fragmentCount: dimensionFragments.length,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      }
    }

    // Format conversation summaries
    const conversations = project.conversations.map(conv => {
      // traces array will have 1 item if starred, 0 if not (due to where filter)
      const hasStarredTrace = conv.traces.length > 0
      return {
        id: conv.id,
        title: conv.title || null,
        createdAt: conv.createdAt.toISOString(),
        status: conv.status,
        messageCount: conv.messages.length,
        fragmentCount: conv.fragments.length,
        starred: hasStarredTrace,
        starredAt: hasStarredTrace ? conv.traces[0].starredAt?.toISOString() || null : null,
        deepDiveId: conv.deepDiveId || null,
        isInitialConversation: conv.isInitialConversation,
      }
    })

    // Format document summaries
    const documents = project.documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status as 'pending' | 'processing' | 'complete' | 'failed',
      createdAt: doc.createdAt.toISOString(),
      fragmentCount: doc.fragments.length,
    }))

    // Format strategy outputs from traces
    const strategyOutputs = traces.map(trace => ({
      id: trace.id,
      createdAt: trace.timestamp.toISOString(),
    }))

    // Format dimensional syntheses for Areas of Focus
    const syntheses = dimensionalSyntheses.map(s => ({
      dimension: s.dimension,
      summary: s.summary,
      keyThemes: s.keyThemes,
      gaps: s.gaps,
      confidence: s.confidence,
      fragmentCount: s.fragmentCount,
    }))

    // Format deep dives
    const deepDives = project.deepDives.map(dd => {
      const conversationDates = dd.conversations.map(c => c.updatedAt)
      const documentDates = dd.documents.map(d => d.updatedAt)
      const allDates = [...conversationDates, ...documentDates, dd.updatedAt]
      const lastActivityAt = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime()))).toISOString()
        : dd.updatedAt.toISOString()

      return {
        id: dd.id,
        topic: dd.topic,
        status: dd.status,
        origin: dd.origin,
        conversationCount: dd.conversations.length,
        documentCount: dd.documents.length,
        lastActivityAt,
        createdAt: dd.createdAt.toISOString(),
      }
    })

    // Determine if strategy is stale (new fragments since last generation)
    const latestGeneration = await prisma.generatedOutput.findFirst({
      where: { projectId, status: 'complete' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, id: true },
    })

    // Count fragments added since last strategy generation
    const fragmentsSinceStrategy = latestGeneration?.startedAt
      ? project.fragments.filter(f => f.createdAt > latestGeneration.startedAt!).length
      : project.fragments.length // No strategy yet = all fragments are new

    // Stale if new fragments exist — doesn't depend on background synthesis completing
    const strategyIsStale = fragmentsSinceStrategy > 0

    // Count fragments since last knowledge summary
    const fragmentsSinceSummary = project.knowledgeUpdatedAt
      ? project.fragments.filter(f => f.createdAt > project.knowledgeUpdatedAt!).length
      : project.fragments.length

    // Return project data
    return NextResponse.json({
      id: project.id,
      name: project.name,
      stats: {
        fragmentCount: project.fragments.length,
        conversationCount: project.conversations.length,
        documentCount: project.documents.length,
        dimensionalCoverage,
        strategyIsStale,
        fragmentsSinceStrategy,
        fragmentsSinceSummary,
      },
      conversations,
      documents,
      deepDives,
      strategyOutputs,
      syntheses,
      knowledgeSummary: project.knowledgeSummary,
      knowledgeUpdatedAt: project.knowledgeUpdatedAt?.toISOString() || null,
      suggestedQuestions: project.suggestedQuestions || [],
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}
