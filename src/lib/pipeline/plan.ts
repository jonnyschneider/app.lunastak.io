import { CLAUDE_MODEL } from '@/lib/claude'
import type { PipelineTrigger, PipelinePlan } from './types'

/**
 * Determine what pipeline steps to run for a given trigger.
 * Pure function — no DB calls, no side effects.
 */
export function planPipeline(trigger: PipelineTrigger): PipelinePlan {
  switch (trigger.type) {
    case 'conversation_ended':
      return trigger.isInitial
        ? {
            trigger: 'conversation_ended',
            extraction: { approach: 'emergent', source: 'conversation' },
            persistFragments: true,
            runSynthesis: true,
            runKnowledgeSummary: true,
            generation: { mode: 'initial', source: 'extracted_context' },
            model: CLAUDE_MODEL,
            backgroundSteps: ['synthesis', 'knowledgeSummary'],
          }
        : {
            trigger: 'conversation_ended',
            extraction: { approach: 'emergent', source: 'conversation' },
            persistFragments: true,
            runSynthesis: true,
            runKnowledgeSummary: true,
            generation: null,
            model: CLAUDE_MODEL,
            backgroundSteps: ['synthesis', 'knowledgeSummary'],
          }

    case 'document_uploaded':
      return {
        trigger: 'document_uploaded',
        extraction: { approach: 'document', source: 'document' },
        persistFragments: true,
        runSynthesis: false, // Deferred — runs when knowledge summary threshold is met
        runKnowledgeSummary: false, // Deferred — executor runs if fragment threshold met
        generation: null,
        model: CLAUDE_MODEL,
        backgroundSteps: [],
      }

    case 'template_submitted':
      return {
        trigger: 'template_submitted',
        extraction: null,
        persistFragments: false,
        runSynthesis: false,
        runKnowledgeSummary: false,
        generation: { mode: 'template', source: 'user_input' },
        model: CLAUDE_MODEL,
        backgroundSteps: ['extractFromTemplate'],
      }

    case 'refresh_requested':
      return {
        trigger: 'refresh_requested',
        extraction: null,
        persistFragments: false,
        runSynthesis: true,
        runKnowledgeSummary: true,
        generation: { mode: 'refresh', source: 'fragments_and_syntheses' },
        model: CLAUDE_MODEL,
        backgroundSteps: [],
      }
  }
}
