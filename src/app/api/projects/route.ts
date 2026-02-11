import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { isGuestUser } from '@/lib/projects'
import { isUserPro } from '@/lib/user'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * GET /api/projects
 * Fetches the user's projects list with summary stats
 * Supports both authenticated users and guests (via cookie)
 */
export async function GET() {
  const session = await getServerSession(authOptions)

  // Determine user ID from session or guest cookie
  let userId: string | null = session?.user?.id || null

  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

    if (guestCookie?.value) {
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
    // Get all active projects for the user
    const projects = await prisma.project.findMany({
      where: {
        userId: userId,
        status: 'active',
      },
      include: {
        _count: {
          select: {
            fragments: { where: { status: 'active' } },
            conversations: { where: { status: { not: 'abandoned' } } },
            generatedOutputs: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Format response (include isDemo flag and strategy status)
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      isDemo: project.isDemo,
      fragmentCount: project._count.fragments,
      conversationCount: project._count.conversations,
      hasStrategy: project._count.generatedOutputs > 0,
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

  // Free users limited to 1 non-demo project
  const isPro = await isUserPro(session.user.id)
  if (!isPro && existingProjects >= 1) {
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
