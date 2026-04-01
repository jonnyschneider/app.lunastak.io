// src/app/api/project/[id]/export-brief/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { generateStrategicBrief } from '@/lib/strategic-brief'
import type { StrategyStatements } from '@/lib/types'

const GUEST_COOKIE_NAME = 'guestUserId'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

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

  // Verify project access (including demo)
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      status: 'active',
      OR: [{ userId }, { isDemo: true }],
    },
    select: { id: true, name: true, suggestedQuestions: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Read from Decision Stack (current live state or specific snapshot)
  const snapshotId = request.nextUrl.searchParams.get('outputId') || request.nextUrl.searchParams.get('snapshotId')

  let strategy: StrategyStatements
  let version: number
  let generatedAt: string

  if (snapshotId) {
    // Export a specific snapshot
    const snapshot = await prisma.decisionStackSnapshot.findFirst({
      where: { id: snapshotId, projectId },
    })
    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }
    const content = snapshot.content as Record<string, unknown>
    strategy = {
      vision: (content.vision as string) || '',
      visionExplainer: (content.visionElaboration as string) || undefined,
      strategy: (content.strategy as string) || '',
      strategyExplainer: (content.strategyElaboration as string) || undefined,
      objectives: (content.objectives as StrategyStatements['objectives']) || [],
      opportunities: (content.opportunities as StrategyStatements['opportunities']) || [],
      principles: (content.principles as StrategyStatements['principles']) || [],
    }
    version = snapshot.version
    generatedAt = snapshot.createdAt.toISOString()
  } else {
    // Export current live state
    const { getStrategyStatements } = await import('@/lib/decision-stack')
    const statements = await getStrategyStatements(projectId)
    if (!statements) {
      return NextResponse.json({ error: 'No strategy found' }, { status: 404 })
    }
    strategy = statements

    const latestSnapshot = await prisma.decisionStackSnapshot.findFirst({
      where: { projectId, trigger: { startsWith: 'post_' } },
      orderBy: { version: 'desc' },
      select: { version: true, createdAt: true },
    })
    version = latestSnapshot?.version ?? 1
    generatedAt = latestSnapshot?.createdAt.toISOString() ?? new Date().toISOString()
  }

  // Get fragment count and syntheses
  const [fragmentCount, syntheses] = await Promise.all([
    prisma.fragment.count({ where: { projectId, status: 'active' } }),
    prisma.dimensionalSynthesis.findMany({
      where: { projectId },
      select: { dimension: true, confidence: true, fragmentCount: true },
      orderBy: { fragmentCount: 'desc' },
    }),
  ])

  const markdown = generateStrategicBrief({
    projectName: project.name,
    version,
    generatedAt,
    strategy,
    fragmentCount,
    syntheses,
    suggestedQuestions: (project.suggestedQuestions as any[]) || [],
  })

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="strategic-brief-v${version}.md"`,
    },
  })
}
