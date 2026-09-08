import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { GROUND_TRUTH_SELECT, onlyGroundTruths } from '@/lib/ground-truth/count'
import { isGuestUser, createGuestUser } from '@/lib/projects'
import { computeDimensionSupport, type SupportLevel } from '@/lib/support/dimension-support'

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
            fragments: { where: { status: 'active' }, select: GROUND_TRUTH_SELECT },
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
            // Read by the support calculator — evidence state and substance can pull a
            // dimension's ball down one band, never lift it (design §16.4) — and by isGroundTruth,
            // which needs sourceRole to tell the assistant's own words from the user's.
            evidence: { select: { text: true, verification: true, sourceRole: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            fragments: { where: { status: 'active' }, select: GROUND_TRUTH_SELECT },
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
        gaps: true,
        confidence: true,
        fragmentCount: true,
      },
    })

    /**
     * What the user is told they have.
     *
     * ⚠ NOT `project.fragments` — that includes system context (bundle tensions, Luna's own
     * turns), which the review deliberately never shows. Counting it at the user produced a
     * knowledgebase total the review could not account for. See `lib/ground-truth/count.ts`.
     *
     * The support model below still reads the FULL set, deliberately: §16.4 is measured, and a
     * dimension's evidence quality does not stop mattering because a row is not user-reviewable.
     */
    const groundTruths = onlyGroundTruths(project.fragments)

    // Dimensional coverage: fragment volume plus the computed support the Harvey ball reads.
    // Support is computed on every read and never stored — a stored field is one refactor away
    // from being fed back to the producer whose work it scores (design §16.4).
    const dimensionalCoverage: Record<string, { fragmentCount: number; support: SupportLevel }> = {}

    for (const dimension of TIER_1_DIMENSIONS) {
      const dimensionFragments = project.fragments.filter(f =>
        f.dimensionTags.some(t => t.dimension === dimension)
      )

      dimensionalCoverage[dimension] = {
        fragmentCount: dimensionFragments.length,
        support: computeDimensionSupport(dimensionFragments),
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
        fragmentCount: onlyGroundTruths(conv.fragments).length,
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
      fragmentCount: onlyGroundTruths(doc.fragments).length,
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
      select: { createdAt: true, version: true, fragmentIds: true },
    })
    // Display version = count of post-snapshots (not raw snapshot version)
    const postSnapshotCount = await prisma.decisionStackSnapshot.count({
      where: { projectId, trigger: { startsWith: 'post_' } },
    })

    /**
     * IS THE STACK STILL BUILT FROM THIS CONTEXT?
     *
     * The old answer compared timestamps — "are there fragments newer than the last snapshot" —
     * which can only see ADDITIONS. Discarding a fragment created before the snapshot moved
     * nothing, so the app reported "in sync" about a strategy built on context the user had since
     * removed. Latent until pruning became reachable after the first strategy (2026-09-08).
     *
     * `DecisionStackSnapshot.fragmentIds` records the set the stack was generated from, so the
     * comparison is a set difference and sees both directions — and can say WHICH, not just
     * whether.
     *
     * Snapshots written before that column exists carry null. That is UNKNOWN, not empty: falling
     * through to the timestamp heuristic is wrong in one direction, where treating null as an
     * empty set would report every ground truth as newly added.
     */
    const snapshotIds = Array.isArray(latestSnapshot?.fragmentIds)
      ? new Set(latestSnapshot!.fragmentIds as string[])
      : null

    const activeIds = new Set(groundTruths.map(f => f.id))

    // The ids, not just the tally: "3 added, 2 discarded" is only useful if the user can then ask
    // WHICH, and the answer is a filter over lists the panel already renders.
    //
    // Ground truths only, for the same reason as every other user-facing count: the diff is a
    // clickable filter over the review, so an id the review will never render would be counted and
    // then vanish when clicked.
    const addedIds = snapshotIds
      ? groundTruths.filter(f => !snapshotIds.has(f.id)).map(f => f.id)
      : latestSnapshot
        ? groundTruths.filter(f => f.createdAt > latestSnapshot.createdAt).map(f => f.id)
        : groundTruths.map(f => f.id)

    const removedIds = snapshotIds
      ? Array.from(snapshotIds).filter(id => !activeIds.has(id))
      : []

    const addedSinceStrategy = addedIds.length
    const removedSinceStrategy = removedIds.length

    const fragmentsSinceStrategy = addedSinceStrategy
    const strategyIsStale = addedSinceStrategy > 0 || removedSinceStrategy > 0

    // Count fragments since last knowledge summary
    const fragmentsSinceSummary = project.knowledgeUpdatedAt
      ? groundTruths.filter(f => f.createdAt > project.knowledgeUpdatedAt!).length
      : groundTruths.length

    // Return project data
    return NextResponse.json({
      id: project.id,
      name: project.name,
      isDemo: project.isDemo,
      stats: {
        fragmentCount: groundTruths.length,
        conversationCount: project.conversations.length,
        documentCount: project.documents.length,
        /**
         * How many context bundles were imported — NOT how many fragments came from them.
         *
         * There is no import record to count: a bundle writes fragments with
         * `sourceType: 'import'` and no `conversationId` or `documentId`, so the artefact leaves
         * no row of its own. What it does leave is one `capturedAt` shared by every fragment in
         * the transaction, so distinct timestamps ARE the distinct imports. Two bundles landing in
         * the same millisecond would undercount; nothing else does.
         *
         * If an Import table ever exists, count that instead and delete this.
         */
        importCount: new Set(
          project.fragments
            .filter(f => f.sourceType === 'import')
            .map(f => f.capturedAt.getTime())
        ).size,
        dimensionalCoverage,
        strategyIsStale,
        fragmentsSinceStrategy,
        /** What changed since the stack was built. `comparable: false` means the snapshot predates
         *  `fragmentIds`, so only additions can be seen and the UI should say less. */
        strategySync: {
          version: postSnapshotCount || null,
          added: addedSinceStrategy,
          removed: removedSinceStrategy,
          comparable: snapshotIds !== null,
          // The one fact a pre-`fragmentIds` snapshot can still offer. Without it the degraded
          // label is a bare "v1", which says nothing a user could act on.
          builtAt: latestSnapshot?.createdAt.toISOString() ?? null,
          addedIds,
          removedIds,
        },
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
