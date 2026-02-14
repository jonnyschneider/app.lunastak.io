import { createFragmentsFromThemes, createFragmentsFromDocument, type ThemeWithDimensions } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'
import { runBackgroundTasks } from '@/lib/background-tasks'
import type { PipelinePlan, PipelineTrigger, PipelineResult } from './types'

/**
 * Execute a pipeline plan.
 * Calls existing library functions — no logic duplication.
 */
export async function executePipeline(
  plan: PipelinePlan,
  trigger: PipelineTrigger
): Promise<PipelineResult> {
  const projectId = trigger.projectId
  let fragmentsCreated = 0
  let extraction: PipelineResult['extraction'] | undefined
  let generation: PipelineResult['generation'] | undefined

  // Layer 0: Extraction (handled by caller for now — routes still own LLM streaming)
  // The plan.extraction field is used by the route to decide which extraction to run.

  // Layer 1: Persist fragments
  // Fragment creation is handled by routes during extraction streaming.
  // This will be moved here as routes migrate (Tasks 5, 8).

  // Layer 2: Meaning-making (background)
  if (plan.runSynthesis || plan.runKnowledgeSummary) {
    const tasks = []
    if (plan.runSynthesis) {
      tasks.push({
        name: 'updateAllSyntheses',
        fn: async () => { await updateAllSyntheses(projectId) },
      })
    }
    if (plan.runKnowledgeSummary) {
      tasks.push({
        name: 'generateKnowledgeSummary',
        fn: async () => { await generateKnowledgeSummary(projectId) },
      })
    }
    runBackgroundTasks({ projectId, tasks })
  }

  // Layer 3: Generation
  // Each generation mode will be implemented as routes migrate.
  // Template generation: Task 4
  // Refresh generation: Task 6
  // Initial generation: Task 7

  return {
    extraction,
    fragmentsCreated,
    generation,
    backgroundTasks: plan.backgroundSteps,
  }
}
