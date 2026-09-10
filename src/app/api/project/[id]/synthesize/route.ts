import { requireProjectAccess, isDenied } from '@/lib/auth/guard'
import { updateAllSyntheses } from '@/lib/synthesis/update-synthesis'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'

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
  const { id: projectId } = await params

  const auth = await requireProjectAccess(projectId)
  if (isDenied(auth)) return auth

  // An archived project is as good as gone to this route.
  if (auth.project.status !== 'active') {
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
