import { prisma } from '@/lib/db'
import { createFragmentsFromThemes, createFragmentsFromDocument, type ThemeWithDimensions } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'
import { runBackgroundTasks } from '@/lib/background-tasks'
import type { StrategyStatements } from '@/lib/types'
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
  if (plan.persistFragments && trigger.type === 'conversation_ended' && trigger.extractionResult?.themes) {
    try {
      const fragments = await createFragmentsFromThemes(
        projectId,
        trigger.conversationId,
        trigger.extractionResult.themes as ThemeWithDimensions[]
      )
      fragmentsCreated = fragments.length
      console.log(`[Pipeline] Created ${fragmentsCreated} fragments`)
    } catch (error) {
      console.error('[Pipeline] Failed to create fragments:', error)
    }

    extraction = {
      extractedContext: trigger.extractionResult.extractedContext,
      dimensionalCoverage: trigger.extractionResult.dimensionalCoverage,
    }
  }

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
  if (plan.generation) {
    switch (plan.generation.mode) {
      case 'template': {
        const t = trigger as Extract<PipelineTrigger, { type: 'template_submitted' }>
        generation = await runTemplateGeneration(t.projectId, t.userId, t.statements)

        // Schedule post-hoc extraction in background
        if (plan.backgroundSteps.includes('extractFromTemplate')) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          runBackgroundTasks({
            projectId: t.projectId,
            tasks: [{
              name: 'extractFromTemplate',
              fn: async () => {
                await fetch(`${baseUrl}/api/project/${t.projectId}/extract-from-template`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ statements: t.statements, traceId: generation!.traceId }),
                })
              },
            }],
          })
        }
        break
      }
      // Other modes added in subsequent tasks
    }
  }

  return {
    extraction,
    fragmentsCreated,
    generation,
    backgroundTasks: plan.backgroundSteps,
  }
}

/**
 * Persist template-submitted strategy.
 * Moved from /api/project/[id]/template-entry/route.ts
 */
async function runTemplateGeneration(
  projectId: string,
  userId: string,
  statements: StrategyStatements
): Promise<NonNullable<PipelineResult['generation']>> {
  // Create synthetic conversation
  const conversation = await prisma.conversation.create({
    data: {
      projectId,
      userId,
      status: 'completed',
      title: 'Template Entry',
    },
  })

  // Create trace
  const trace = await prisma.trace.create({
    data: {
      conversationId: conversation.id,
      projectId,
      userId,
      extractedContext: { source: 'template-entry', themes: [] },
      output: statements as object,
      claudeThoughts: 'User-provided template entry',
      modelUsed: 'template-entry',
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
    },
  })

  // Seed StrategyVersion records
  const versionCreates = [
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'vision',
        content: { text: statements.vision },
        version: 1,
        createdBy: 'user',
        sourceType: 'template',
        sourceId: trace.id,
      },
    }),
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'strategy',
        content: { text: statements.strategy },
        version: 1,
        createdBy: 'user',
        sourceType: 'template',
        sourceId: trace.id,
      },
    }),
    ...statements.objectives.map((obj) =>
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'objective',
          componentId: obj.id,
          content: {
            title: obj.title,
            pithy: obj.pithy,
            objective: obj.objective,
            omtm: obj.omtm,
            aspiration: obj.aspiration,
            explanation: obj.explanation,
          } as object,
          version: 1,
          createdBy: 'user',
          sourceType: 'template',
          sourceId: trace.id,
        },
      })
    ),
  ]
  await prisma.$transaction(versionCreates)

  // Persist principles as UserContent
  if (statements.principles && statements.principles.length > 0) {
    await prisma.userContent.createMany({
      data: statements.principles.map((principle) => ({
        projectId,
        type: 'principle',
        content: JSON.stringify(principle),
        status: 'complete',
      })),
    })
  }

  // Create GeneratedOutput
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId,
      userId,
      outputType: 'full_decision_stack',
      version: 1,
      status: 'complete',
      content: statements as object,
      modelUsed: 'template-entry',
      startedAt: new Date(),
    },
  })

  console.log('[Pipeline] Template generation complete for project:', projectId)

  return {
    generatedOutputId: generatedOutput.id,
    traceId: trace.id,
    statements,
    version: 1,
    changeSummary: null,
  }
}
