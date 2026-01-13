import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

/**
 * GET /api/projects
 * Fetches the user's projects list with summary stats
 */
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active projects for the user
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
        status: 'active',
      },
      include: {
        _count: {
          select: {
            fragments: { where: { status: 'active' } },
            conversations: { where: { status: { not: 'abandoned' } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Format response (include isDemo flag)
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      isDemo: project.isDemo,
      fragmentCount: project._count.fragments,
      conversationCount: project._count.conversations,
      updatedAt: project.updatedAt.toISOString(),
    }))

    return NextResponse.json({ projects: formattedProjects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

async function initializeSynthesisRecords(projectId: string): Promise<void> {
  const records = TIER_1_DIMENSIONS.map((dimension) => ({
    projectId,
    dimension,
    summary: null,
    keyThemes: [],
    keyQuotes: [],
    gaps: [],
    contradictions: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
    synthesizedBy: 'init',
  }))

  await prisma.dimensionalSynthesis.createMany({
    data: records,
    skipDuplicates: true,
  })
}

/**
 * POST /api/projects
 * Creates a new project (checks paywall limits)
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check existing non-demo projects
  const existingProjects = await prisma.project.count({
    where: {
      userId: session.user.id,
      isDemo: false,
      status: 'active',
    },
  })

  // Check if user is paid
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPaid: true },
  })

  // Free users limited to 1 non-demo project
  if (!user?.isPaid && existingProjects >= 1) {
    return NextResponse.json({
      error: 'Project limit reached',
      paywall: {
        blocked: true,
        modal: {
          title: 'Upgrade to Pro',
          message: 'Free accounts are limited to one project. Upgrade to Pro for unlimited projects.',
          ctaLabel: 'Learn More',
          ctaUrl: 'https://lunastak.io/pricing',
        },
      },
    }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const name = body.name || 'My Strategy'

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name,
        status: 'active',
        isDemo: false,
      },
    })

    await initializeSynthesisRecords(project.id)

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        isDemo: project.isDemo,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
