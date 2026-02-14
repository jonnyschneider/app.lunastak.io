import type { ExtractedContextVariant } from '@/lib/types'
import type { StrategyStatements } from '@/lib/types'
import type { EmergentThemeContract } from '@/lib/contracts/extraction'

/**
 * Pipeline Triggers — what happened, provided by API routes.
 * Routes provide raw input. Orchestrator decides what to do.
 */
export type PipelineTrigger =
  | {
      type: 'conversation_ended'
      projectId: string
      conversationId: string
      userId: string | null
      isInitial: boolean
      experimentVariant: string | null
      // Set by route after extraction completes (route owns streaming)
      extractionResult?: {
        extractedContext: ExtractedContextVariant
        dimensionalCoverage?: unknown
        themes?: EmergentThemeContract[]
      }
    }
  | {
      type: 'document_uploaded'
      projectId: string
      documentId: string
      documentText: string
      uploadContext?: string
    }
  | {
      type: 'template_submitted'
      projectId: string
      userId: string
      statements: StrategyStatements
    }
  | {
      type: 'refresh_requested'
      projectId: string
      userId: string
    }

/**
 * Pipeline Plan — what should we do?
 * Returned by planPipeline(). Pure data, no side effects.
 */
export interface PipelinePlan {
  trigger: PipelineTrigger['type']

  // Layer 0: Extraction
  extraction:
    | { approach: 'emergent'; source: 'conversation' }
    | { approach: 'document'; source: 'document' }
    | null

  // Layer 1: Structuring
  persistFragments: boolean

  // Layer 2: Meaning-making
  runSynthesis: boolean
  runKnowledgeSummary: boolean

  // Layer 3: Output
  generation:
    | { mode: 'initial'; source: 'extracted_context' }
    | { mode: 'refresh'; source: 'fragments_and_syntheses' }
    | { mode: 'template'; source: 'user_input' }
    | null

  // Config
  model: string
  backgroundSteps: string[]
}

/**
 * Pipeline Result — what happened, returned to API routes.
 * Routes format this for their response pattern (stream, poll, sync).
 */
export interface PipelineResult {
  // Layer 0
  extraction?: {
    extractedContext: ExtractedContextVariant
    dimensionalCoverage?: unknown
  }

  // Layer 1
  fragmentsCreated: number

  // Layer 3
  generation?: {
    generatedOutputId: string
    traceId: string
    statements: StrategyStatements
    version: number
    changeSummary?: string | null
  }

  // Execution metadata
  backgroundTasks: string[]
}
