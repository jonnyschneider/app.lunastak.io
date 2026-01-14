import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { updateAllSyntheses } from '@/lib/synthesis/update-synthesis'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'

const GUEST_COOKIE_NAME = 'guestUserId'

export const maxDuration = 300 // 5 minutes for Pro plan

// Progress step type for streaming updates
type SynthesisStep =
  | 'starting'
  | 'updating_dimensions'
  | 'generating_summary'
  | 'complete'
  | 'error'

interface ProgressUpdate {
  step: SynthesisStep
  error?: string
}

/**
 * POST /api/project/[id]/synthesize
 * Triggers full synthesis for a project with streaming progress
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id: projectId } = await params

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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify project exists and belongs to user
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
      status: 'active',
    },
    select: { id: true },
  })

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create a streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (update: ProgressUpdate) => {
        controller.enqueue(encoder.encode(JSON.stringify(update) + '\n'))
      }

      try {
        console.log(`[Synthesize] Starting synthesis for project ${projectId}`)

        // Step 1: Update dimensional syntheses
        sendProgress({ step: 'updating_dimensions' })
        await updateAllSyntheses(projectId)

        // Step 2: Generate knowledge summary
        sendProgress({ step: 'generating_summary' })
        await generateKnowledgeSummary(projectId)

        // Complete
        sendProgress({ step: 'complete' })
        console.log(`[Synthesize] Synthesis complete for project ${projectId}`)

        controller.close()
      } catch (error) {
        console.error('Synthesis error:', error)
        sendProgress({
          step: 'error',
          error: error instanceof Error ? error.message : 'Synthesis failed',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
