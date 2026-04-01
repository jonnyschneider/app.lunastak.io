// src/app/api/project/[id]/generate-strategy/route.ts
// Generate strategy from existing fragments — no conversation required.
// Thin route: auth + validation, then delegates to pipeline orchestrator.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import type { GenerationStartedContract } from '@/lib/contracts/generation-status'

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

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check we have fragments to work with
  const fragmentCount = await prisma.fragment.count({
    where: { projectId, status: 'active' },
  })

  if (fragmentCount === 0) {
    return NextResponse.json(
      { error: 'No fragments found. Upload documents or import a context bundle first.' },
      { status: 400 }
    )
  }

  // Check guest API limit
  const { blocked } = await checkAndIncrementGuestApiCalls(userId)
  if (blocked) {
    return NextResponse.json(
      { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
      { status: 429 }
    )
  }

  // Check for previous strategy to get correct version
  const previousOutput = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack' },
    orderBy: { createdAt: 'desc' },
  })

  // Pre-create GeneratedOutput for polling
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId,
      userId,
      outputType: 'full_decision_stack',
      version: (previousOutput?.version ?? 0) + 1,
      status: 'generating',
      startedAt: new Date(),
      content: {},
    },
  })

  console.log('[GenerateStrategy] Created GeneratedOutput:', generatedOutput.id, 'from', fragmentCount, 'fragments')

  // Set generation status for new polling
  const { setGenerationStatus } = await import('@/lib/decision-stack')
  await setGenerationStatus(projectId, 'generating')

  const trigger = {
    type: 'generate_from_knowledge' as const,
    projectId,
    userId,
    generatedOutputId: generatedOutput.id,
  }

  const generationWork = (async () => {
    try {
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger)
    } catch (error) {
      console.error('[GenerateStrategy] Background generation failed:', error)
      await prisma.generatedOutput.update({
        where: { id: generatedOutput.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Strategy generation failed',
        },
      })
    }
  })()

  if (process.env.VERCEL) {
    waitUntil(generationWork)
  } else {
    await generationWork
  }

  const response: GenerationStartedContract = {
    status: 'started',
    generationId: generatedOutput.id,
  }

  return NextResponse.json(response)
}
