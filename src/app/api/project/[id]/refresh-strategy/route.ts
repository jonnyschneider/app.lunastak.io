// src/app/api/project/[id]/refresh-strategy/route.ts
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser, checkAndIncrementGuestApiCalls } from '@/lib/projects'
import { planPipeline, executePipeline } from '@/lib/pipeline'
import type { RefreshStrategyProgressContract } from '@/lib/contracts/refresh-strategy'

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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true },
  })

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get previous strategy - REQUIRED for refresh
  const previousOutput = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack' },
    orderBy: { createdAt: 'desc' },
  })

  if (!previousOutput) {
    return new Response(
      JSON.stringify({ error: 'No strategy to refresh. Complete a conversation first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Check guest API limit
  const { blocked } = await checkAndIncrementGuestApiCalls(userId)
  if (blocked) {
    return new Response(
      JSON.stringify({ error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (update: RefreshStrategyProgressContract) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(update) + '\n'))
        } catch (e) {
          // Controller may be closed
        }
      }

      try {
        sendProgress({ step: 'loading_context' })
        sendProgress({ step: 'generating_strategy' })

        const trigger = {
          type: 'refresh_requested' as const,
          projectId,
          userId: userId!,
        }
        const plan = planPipeline(trigger)
        const result = await executePipeline(plan, trigger)

        sendProgress({ step: 'complete' })
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              step: 'complete',
              traceId: result.generation?.traceId,
              changeSummary: result.generation?.changeSummary,
              version: result.generation?.version,
            }) + '\n'
          )
        )
        controller.close()
      } catch (error) {
        console.error('[RefreshStrategy] Error:', error)
        sendProgress({
          step: 'error',
          error: error instanceof Error ? error.message : 'Refresh failed',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
