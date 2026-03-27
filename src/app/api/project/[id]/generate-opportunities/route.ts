// src/app/api/project/[id]/generate-opportunities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import type { OpportunityGenerationStartedContract, CoverageWarning } from '@/lib/contracts/opportunity-generation'

export const maxDuration = 300

const GUEST_COOKIE_NAME = 'guestUserId'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

  // Auth: session or guest cookie
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

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true, isDemo: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check that a decision stack exists (Direction must exist first)
  const decisionStack = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack', status: 'complete' },
    orderBy: { createdAt: 'desc' },
  })

  if (!decisionStack) {
    return NextResponse.json(
      { error: 'No Direction found. Complete your Direction first.' },
      { status: 400 }
    )
  }

  // Check guest API limit
  if (!project.isDemo) {
    const { blocked } = await checkAndIncrementGuestApiCalls(userId)
    if (blocked) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      )
    }
  }

  // Check dimensional coverage for warnings
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId },
    select: { dimension: true, confidence: true, fragmentCount: true },
  })

  const coverageWarnings: CoverageWarning[] = syntheses
    .filter(s => s.confidence === 'LOW' || s.fragmentCount < 3)
    .map(s => ({
      dimension: s.dimension,
      dimensionLabel: s.dimension.replace(/_/g, ' ').toLowerCase(),
      confidence: s.confidence,
      fragmentCount: s.fragmentCount,
    }))

  // Pre-create GeneratedOutput for polling
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId,
      userId,
      outputType: 'opportunities',
      version: 1,
      status: 'generating',
      startedAt: new Date(),
      content: {},
    },
  })

  console.log('[GenerateOpportunities] Created GeneratedOutput:', generatedOutput.id, 'status: generating')

  // Fire-and-forget
  waitUntil((async () => {
    try {
      const trigger = {
        type: 'generate_opportunities' as const,
        projectId,
        userId,
        generatedOutputId: generatedOutput.id,
      }
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger)
    } catch (error) {
      console.error('[GenerateOpportunities] Background generation failed:', error)
      await prisma.generatedOutput.update({
        where: { id: generatedOutput.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Opportunity generation failed',
        },
      })
    }
  })())

  const response: OpportunityGenerationStartedContract = {
    status: 'started',
    generationId: generatedOutput.id,
    ...(coverageWarnings.length > 0 ? { coverageWarnings } : {}),
  }

  console.log('[GenerateOpportunities] Returning immediately, generation running in background')
  return NextResponse.json(response)
}
