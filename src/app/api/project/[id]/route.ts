import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { isGuestUser, createGuestUser } from '@/lib/projects'

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
    // Demo deep-link fallback: if the requested project is a demo, mint a
    // guest session inline so unauthenticated visitors from marketing/share
    // links can view it. Mirrors /api/guest/init.
    const demoCheck = await prisma.project.findFirst({
      where: { id: projectId, isDemo: true, status: 'active' },
      select: { id: true },
    })

    if (demoCheck) {
      const guestUser = await createGuestUser()
      userId = guestUser.id

      const cookieStore = await cookies()
      cookieStore.set(GUEST_COOKIE_NAME, guestUser.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the project with related data
    // Demo projects are accessible to any authenticated user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        status: 'active',
        OR: [
          { userId: userId },
          { isDemo: true },
        ],
      },
      include: {
        conversations: {
          where: { status: { not: 'abandoned' } },
          orderBy: { createdAt: 'desc' },
          take: 20, // Fetch more to ensure we have enough after filtering
          include: {
            messages: {
              select: { id: true, content: true, role: true },
              orderBy: { stepNumber: 'asc' as const },
            },
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
      // First assistant message — used to match conversations to provocations/gaps
      const firstMessage = conv.messages.find(m => m.role === 'assistant')
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
        firstMessageContent: firstMessage?.content || null,
        originType: conv.originType || null,
        originText: conv.originText || null,
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

    // Load Decision Stack (replaces GeneratedOutput reads)
    const { getDecisionStack, assembleStrategyStatements } = await import('@/lib/decision-stack')
    const decisionStack = await getDecisionStack(projectId)
    const hasStrategy = !!decisionStack && decisionStack.vision !== ''
    const strategyStatements = decisionStack ? assembleStrategyStatements(decisionStack) : null

    // Staleness: compare fragment timestamps against latest snapshot
    const latestSnapshot = await prisma.decisionStackSnapshot.findFirst({
      where: { projectId, trigger: { startsWith: 'post_' } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, version: true },
    })
    // Display version = count of post-snapshots (not raw snapshot version)
    const postSnapshotCount = await prisma.decisionStackSnapshot.count({
      where: { projectId, trigger: { startsWith: 'post_' } },
    })

    const fragmentsSinceStrategy = latestSnapshot
      ? project.fragments.filter(f => f.createdAt > latestSnapshot.createdAt).length
      : project.fragments.length

    const strategyIsStale = fragmentsSinceStrategy > 0

    // Count fragments since last knowledge summary
    const fragmentsSinceSummary = project.knowledgeUpdatedAt
      ? project.fragments.filter(f => f.createdAt > project.knowledgeUpdatedAt!).length
      : project.fragments.length

    // Return project data
    return NextResponse.json({
      id: project.id,
      name: project.name,
      isDemo: project.isDemo,
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
      hasStrategy,
      strategyStatements,
      latestSnapshotVersion: postSnapshotCount || null,
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
