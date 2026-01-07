import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

/**
 * GET /api/project/[id]
 * Fetches a specific project's data including stats, conversations, and documents
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id: projectId } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the project with related data
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
        status: 'active',
      },
      include: {
        conversations: {
          where: { status: { not: 'abandoned' } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            messages: { select: { id: true } },
            fragments: { where: { status: 'active' }, select: { id: true } },
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
    const conversations = project.conversations.map(conv => ({
      id: conv.id,
      createdAt: conv.createdAt.toISOString(),
      status: conv.status,
      messageCount: conv.messages.length,
      fragmentCount: conv.fragments.length,
    }))

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

    // Return project data
    return NextResponse.json({
      id: project.id,
      name: project.name,
      stats: {
        fragmentCount: project.fragments.length,
        conversationCount: project.conversations.length,
        documentCount: project.documents.length,
        dimensionalCoverage,
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
