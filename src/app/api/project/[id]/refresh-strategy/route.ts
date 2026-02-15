// src/app/api/project/[id]/refresh-strategy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { updateAllSyntheses } from '@/lib/synthesis'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import { waitUntil } from '@vercel/functions'
import type { GenerationStartedContract } from '@/lib/contracts/generation-status'

export const maxDuration = 300 // 5 minutes for Pro plan

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
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get previous strategy - REQUIRED for refresh
  const previousOutput = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack' },
    orderBy: { createdAt: 'desc' },
  })

  if (!previousOutput) {
    return NextResponse.json(
      { error: 'No strategy to refresh. Complete a conversation first.' },
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

  // Foreground: update stale syntheses before generation reads them
  // updateAllSyntheses internally skips dimensions with no new fragments,
  // so calling unconditionally is safe and cheap when nothing's stale.
  console.log('[RefreshStrategy] Running foreground synthesis update')
  await updateAllSyntheses(projectId)

  // Pre-create GeneratedOutput for polling
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId,
      userId,
      outputType: 'full_decision_stack',
      version: previousOutput.version + 1,
      status: 'generating',
      startedAt: new Date(),
      content: {}, // Populated on completion
    },
  })

  console.log('[RefreshStrategy] Created GeneratedOutput:', generatedOutput.id, 'status: generating')

  // Fire-and-forget: run generation in background
  // NOTE: plan.runSynthesis is true but we already ran synthesis above,
  // so the executor will call updateAllSyntheses again — this is safe because
  // it will find no new fragments and skip immediately.
  waitUntil((async () => {
    try {
      const trigger = {
        type: 'refresh_requested' as const,
        projectId,
        userId,
        generatedOutputId: generatedOutput.id,
      }
      const plan = planPipeline(trigger)
      await executePipeline(plan, trigger)
    } catch (error) {
      console.error('[RefreshStrategy] Background generation failed:', error)
      await prisma.generatedOutput.update({
        where: { id: generatedOutput.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Refresh failed',
        },
      })
    }
  })())

  // Return immediately with generationId for polling
  const response: GenerationStartedContract = {
    status: 'started',
    generationId: generatedOutput.id,
  }

  console.log('[RefreshStrategy] Returning immediately, generation running in background')
  return NextResponse.json(response)
}
