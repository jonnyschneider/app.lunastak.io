import { NextResponse } from 'next/server'
import { GROUND_TRUTH_SELECT, onlyGroundTruths } from '@/lib/ground-truth/count'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { isUserPro } from '@/lib/user'
import { requireUser, isDenied } from '@/lib/auth/guard'

/**
 * GET /api/projects
 * Fetches the user's projects list with summary stats
 * Supports both authenticated users and guests (via cookie)
 */
export async function GET() {
  const requester = await requireUser()
  if (isDenied(requester)) return requester
  const { userId } = requester

  try {
    // Get all active projects for the user
    const projects = await prisma.project.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        fragments: { where: { status: 'active' }, select: GROUND_TRUTH_SELECT },
        _count: {
          select: {
            conversations: { where: { status: { not: 'abandoned' } } },
          },
        },
        decisionStack: { select: { vision: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Format response (include isDemo flag and strategy status)
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      isDemo: project.isDemo,
      // Ground truths, matching every other count the user sees. See lib/ground-truth/count.ts.
      fragmentCount: onlyGroundTruths(project.fragments).length,
      conversationCount: project._count.conversations,
      hasStrategy: !!project.decisionStack && project.decisionStack.vision !== '',
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
    gaps: [],
    confidence: 'LOW' as const,
    fragmentCount: 0,
    lastSynthesizedAt: new Date(),
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
  // Signed-up users only: a guest works in the project they were given, and creating more is what
  // the paywall below meters.
  const requester = await requireUser({ guests: false })
  if (isDenied(requester)) return requester
  const { userId } = requester

  // Check existing non-demo projects
  const existingProjects = await prisma.project.count({
    where: {
      userId,
      isDemo: false,
      status: 'active',
    },
  })

  // Free users limited to 1 non-demo project
  const isPro = await isUserPro(userId)
  if (!isPro && existingProjects >= 1) {
    return NextResponse.json({
      error: 'Project limit reached',
      paywall: {
        blocked: true,
        modal: {
          title: 'Upgrade to Pro',
          message: 'Free accounts are limited to one project. Upgrade to Pro for unlimited projects.',
          ctaLabel: 'Learn More',
          ctaUrl: 'https://lunastak.io/docs/getting-started#plans',
        },
      },
    }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    // Auto-generate name: "My Project 1", "My Project 2", etc.
    let name = body.name
    if (!name) {
      const totalProjects = await prisma.project.count({
        where: { userId: userId },
      })
      name = `My Project ${totalProjects + 1}`
    }

    const project = await prisma.project.create({
      data: {
        userId,
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
