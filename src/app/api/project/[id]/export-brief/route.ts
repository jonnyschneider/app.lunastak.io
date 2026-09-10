// src/app/api/project/[id]/export-brief/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectAccess, isDenied } from '@/lib/auth/guard'
import { generateStrategicBrief } from '@/lib/strategic-brief'
import type { StrategyStatements } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  // A demo project's brief is exportable by anyone signed in, like the rest of the demo.
  const auth = await requireProjectAccess(projectId, { access: 'read' })
  if (isDenied(auth)) return auth

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: 'active' },
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
