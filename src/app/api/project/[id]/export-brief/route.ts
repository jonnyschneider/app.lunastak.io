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

  // Determine which output to export
  const outputId = request.nextUrl.searchParams.get('outputId')

  const generatedOutput = outputId
    ? await prisma.generatedOutput.findFirst({
        where: { id: outputId, projectId, status: 'complete' },
      })
    : await prisma.generatedOutput.findFirst({
        where: { projectId, outputType: 'full_decision_stack', status: 'complete' },
        orderBy: { createdAt: 'desc' },
      })

  if (!generatedOutput) {
    return NextResponse.json({ error: 'No strategy found' }, { status: 404 })
  }

  const strategy = generatedOutput.content as unknown as StrategyStatements

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
    version: generatedOutput.version,
    generatedAt: generatedOutput.createdAt.toISOString(),
    strategy,
    fragmentCount,
    syntheses,
    suggestedQuestions: (project.suggestedQuestions as any[]) || [],
  })

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="strategic-brief-v${generatedOutput.version}.md"`,
    },
  })
}
