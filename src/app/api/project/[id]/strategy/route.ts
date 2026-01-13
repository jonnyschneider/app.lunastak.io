import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Type for the content stored in GeneratedOutput
interface StrategyContent {
  vision?: string
  strategy?: string
  objectives?: Array<{
    title: string
    description: string
    timeframe?: string
    direction?: string
    targetMetric?: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // Fetch project with latest strategy output and fragment count
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        generatedOutputs: {
          where: { outputType: 'full_decision_stack' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            content: true,
          },
        },
        _count: {
          select: { fragments: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const latestOutput = project.generatedOutputs[0]

    // Parse content from JSON field
    let latestStrategy = null
    if (latestOutput) {
      const content = latestOutput.content as StrategyContent
      latestStrategy = {
        id: latestOutput.id,
        createdAt: latestOutput.createdAt,
        vision: content.vision || null,
        strategy: content.strategy || null,
        objectives: content.objectives || [],
      }
    }

    // Check if there's new thinking since last strategy
    const hasNewThinking = latestOutput
      ? project.updatedAt > latestOutput.createdAt
      : project._count.fragments > 0

    return NextResponse.json({
      id: project.id,
      name: project.name,
      latestStrategy,
      hasNewThinking,
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
