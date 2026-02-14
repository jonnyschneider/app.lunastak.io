import { prisma } from '@/lib/db'
import { createFragmentsFromThemes, createFragmentsFromDocument, type ThemeWithDimensions } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { generateKnowledgeSummary } from '@/lib/knowledge-summary'
import { runBackgroundTasks } from '@/lib/background-tasks'
import { createMessage } from '@/lib/claude'
import { extractXML, parseOKRObjectives } from '@/lib/utils'
import { OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT } from '@/lib/prompts/shared/objectives'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import { convertLegacyObjectives } from '@/lib/placeholders'
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs'
import { logStatsigEvent } from '@/lib/statsig'
import { getCurrentPrompt } from '@/lib/prompts'
import type { StrategyStatements, Objective } from '@/lib/types'
import type { RefreshStrategyDeltaContract } from '@/lib/contracts/refresh-strategy'
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

  if (plan.persistFragments && trigger.type === 'document_uploaded' && trigger.extractionResult?.themes) {
    try {
      const fragments = await createFragmentsFromDocument(
        projectId,
        trigger.documentId,
        trigger.extractionResult.themes as ThemeWithDimensions[]
      )
      fragmentsCreated = fragments.length
      console.log(`[Pipeline] Created ${fragmentsCreated} document fragments`)
    } catch (error) {
      console.error('[Pipeline] Failed to create document fragments:', error)
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
      case 'refresh': {
        const t = trigger as Extract<PipelineTrigger, { type: 'refresh_requested' }>
        generation = await runRefreshGeneration(t.projectId, t.userId, plan.model)
        break
      }
      case 'initial': {
        const t = trigger as Extract<PipelineTrigger, { type: 'conversation_ended' }>
        generation = await runInitialGeneration(
          t.projectId,
          t.conversationId,
          t.userId,
          t.experimentVariant,
          t.generatedOutputId,
          plan.model
        )
        break
      }
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

// --- Prompts for refresh strategy ---

const STRATEGY_UPDATE_PROMPT = `You are Luna, refining a business strategy based on new insights.

## Current Strategy
Vision: {current_vision}
Strategy: {current_strategy}
Objectives:
{current_objectives}

## Strategic Context (Dimensional Syntheses)
{dimensional_summaries}

## What's New (since last strategy)
{new_fragments_content}

## What's Been Removed
{archived_fragments_content}

---

Produce a COMPLETE REPLACEMENT strategy that reflects the current state of understanding. Your output replaces the previous strategy entirely — do not concatenate or append new text onto the old text.

Be conservative: if the vision still holds, output it unchanged. If an objective is still valid, keep it as-is. Only modify what the new insights warrant. But every field must be a clean, self-contained statement — not old text with new text bolted on.

${OBJECTIVE_GUIDELINES}

Output format:
<statements>
  <vision>Your updated or unchanged vision</vision>
  <strategy>Your updated or unchanged strategy</strategy>
  ${OBJECTIVE_XML_FORMAT}
</statements>`

const CHANGE_SUMMARY_PROMPT = `Compare these two versions of a business strategy and summarize what changed and why.

## Previous Strategy
Vision: {old_vision}
Strategy: {old_strategy}
Objectives: {old_objectives}

## Updated Strategy
Vision: {new_vision}
Strategy: {new_strategy}
Objectives: {new_objectives}

## New Insights That Informed Changes
{new_fragments_summary}

Write 2-4 sentences explaining what changed and why. Be specific. If nothing meaningful changed, say "No significant changes - strategy remains aligned with current insights."`

/**
 * Generate refreshed strategy from accumulated fragments + syntheses.
 * Moved from /api/project/[id]/refresh-strategy/route.ts
 */
async function runRefreshGeneration(
  projectId: string,
  userId: string,
  model: string
): Promise<NonNullable<PipelineResult['generation']>> {
  // Load previous strategy
  const previousOutput = await prisma.generatedOutput.findFirst({
    where: { projectId, outputType: 'full_decision_stack' },
    orderBy: { createdAt: 'desc' },
  })

  if (!previousOutput) {
    throw new Error('No previous strategy found for refresh')
  }

  const previousStatements = previousOutput.content as unknown as StrategyStatements

  // Get dimensional syntheses
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId, fragmentCount: { gt: 0 } },
    orderBy: { fragmentCount: 'desc' },
  })

  // Get delta: new fragments since last generation
  const newFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: 'active',
      createdAt: { gt: previousOutput.createdAt },
    },
    select: { content: true },
    take: 20,
  })

  // Get removed fragments (archived since last generation)
  const removedFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: { in: ['archived', 'soft_deleted'] },
      updatedAt: { gt: previousOutput.createdAt },
    },
    select: { content: true },
    take: 10,
  })

  const delta: RefreshStrategyDeltaContract = {
    newFragmentCount: newFragments.length,
    removedFragmentCount: removedFragments.length,
    newFragmentSummaries: newFragments.map(f => f.content.slice(0, 100)),
    removedFragmentSummaries: removedFragments.map(f => f.content.slice(0, 100)),
  }

  // Build prompt context
  const dimensionalSummaries = syntheses
    .map(s => {
      const context = DIMENSION_CONTEXT[s.dimension as Tier1Dimension]
      const name = context?.name || s.dimension
      return `### ${name}\n${s.summary || 'No summary yet'}`
    })
    .join('\n\n')

  const currentObjectives = previousStatements.objectives
    .map((o, i) => {
      const title = o.title || o.objective || o.pithy || ''
      const metric = o.omtm || o.keyResults?.[0]?.signal || o.metric?.metricName || ''
      const aspiration = o.aspiration || o.keyResults?.[0]?.target || o.metric?.summary || ''
      return `${i + 1}. ${title}${metric ? ` (${metric}${aspiration ? ': ' + aspiration : ''})` : ''}`
    })
    .join('\n')

  const newFragmentsContent = newFragments.length > 0
    ? newFragments.map(f => `- ${f.content}`).join('\n')
    : 'No new insights since last strategy.'

  const archivedContent = removedFragments.length > 0
    ? removedFragments.map(f => `- ${f.content}`).join('\n')
    : 'No insights removed.'

  // Generate updated strategy
  const updatePrompt = STRATEGY_UPDATE_PROMPT
    .replace('{current_vision}', previousStatements.vision)
    .replace('{current_strategy}', previousStatements.strategy)
    .replace('{current_objectives}', currentObjectives)
    .replace('{dimensional_summaries}', dimensionalSummaries)
    .replace('{new_fragments_content}', newFragmentsContent)
    .replace('{archived_fragments_content}', archivedContent)

  const genResponse = await createMessage({
    model,
    max_tokens: 3000,
    messages: [{ role: 'user', content: updatePrompt }],
    temperature: 0.7,
  }, 'refresh_strategy_generation')

  const genContent = genResponse.content[0]?.type === 'text'
    ? genResponse.content[0].text
    : ''

  const statementsXML = extractXML(genContent, 'statements')
  const objectivesXML = extractXML(statementsXML, 'objectives')

  // Parse objectives using shared parser
  const parsedObjectives = parseOKRObjectives(objectivesXML)

  // Fallback: if no objectives parsed, preserve previous objectives
  const objectives = parsedObjectives.length > 0
    ? parsedObjectives
    : previousStatements.objectives

  const newStatements: StrategyStatements = {
    vision: extractXML(statementsXML, 'vision') || previousStatements.vision,
    strategy: extractXML(statementsXML, 'strategy') || previousStatements.strategy,
    objectives,
    opportunities: previousStatements.opportunities || [],
    principles: previousStatements.principles || [],
  }

  // Generate change summary (best-effort)
  let changeSummary: string | null = null
  try {
    const oldObjectives = previousStatements.objectives
      .map((o, i) => `${i + 1}. ${o.title || o.objective || o.pithy}`)
      .join('\n')
    const newObjectives = newStatements.objectives
      .map((o, i) => `${i + 1}. ${o.title || o.objective || o.pithy}`)
      .join('\n')

    const summaryPrompt = CHANGE_SUMMARY_PROMPT
      .replace('{old_vision}', previousStatements.vision)
      .replace('{old_strategy}', previousStatements.strategy)
      .replace('{old_objectives}', oldObjectives)
      .replace('{new_vision}', newStatements.vision)
      .replace('{new_strategy}', newStatements.strategy)
      .replace('{new_objectives}', newObjectives)
      .replace('{new_fragments_summary}', delta.newFragmentSummaries.join('; '))

    const summaryResponse = await createMessage({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: summaryPrompt }],
      temperature: 0.5,
    }, 'refresh_strategy_summary')

    changeSummary = summaryResponse.content[0]?.type === 'text'
      ? summaryResponse.content[0].text.trim()
      : null
  } catch (summaryError) {
    console.error('[Pipeline] Change summary failed:', summaryError)
  }

  // Persist: synthetic conversation, trace, generated output
  const syntheticConversation = await prisma.conversation.create({
    data: {
      userId,
      projectId,
      status: 'completed',
      title: 'Strategy Refresh',
      currentPhase: 'generation',
    },
  })

  const trace = await prisma.trace.create({
    data: {
      conversationId: syntheticConversation.id,
      projectId,
      userId,
      extractedContext: { type: 'refresh', delta } as any,
      output: newStatements as any,
      claudeThoughts: `Incremental refresh based on ${delta.newFragmentCount} new and ${delta.removedFragmentCount} removed fragments.`,
      modelUsed: model,
      totalTokens: genResponse.usage.input_tokens + genResponse.usage.output_tokens,
      promptTokens: genResponse.usage.input_tokens,
      completionTokens: genResponse.usage.output_tokens,
      latencyMs: 0,
    },
  })

  const newOutput = await prisma.generatedOutput.create({
    data: {
      projectId,
      userId,
      outputType: 'full_decision_stack',
      version: previousOutput.version + 1,
      content: newStatements as any,
      generatedFrom: 'incremental_refresh',
      modelUsed: model,
      promptTokens: genResponse.usage.input_tokens,
      completionTokens: genResponse.usage.output_tokens,
      previousOutputId: previousOutput.id,
      changeSummary,
    },
  })

  // Reset unsynthesized fragment count
  await prisma.project.update({
    where: { id: projectId },
    data: { knowledgeUpdatedAt: new Date() },
  })

  console.log('[Pipeline] Refresh generation complete for project:', projectId)

  return {
    generatedOutputId: newOutput.id,
    traceId: trace.id,
    statements: newStatements,
    version: newOutput.version,
    changeSummary,
  }
}

/**
 * Generate initial strategy from extracted context.
 * Moved from /api/generate/route.ts (runBackgroundGeneration)
 */
async function runInitialGeneration(
  projectId: string,
  conversationId: string,
  userId: string | null,
  experimentVariant: string | null,
  generatedOutputId: string | undefined,
  model: string
): Promise<NonNullable<PipelineResult['generation']>> {
  const startTime = Date.now()

  // Load fragments from DB (created earlier in the pipeline)
  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: 'active' },
    select: { id: true, content: true },
    orderBy: { capturedAt: 'desc' },
  })

  if (fragments.length === 0) {
    throw new Error('No active fragments found for initial generation')
  }

  // Build prompt from fragments — same data as extractedContext.themes, read from DB
  const generationPrompt = getCurrentPrompt('generation')
  const themesText = fragments
    .map(f => f.content)
    .join('\n\n')
  const prompt = generationPrompt.template.replace('{themes}', themesText)

  // Call Claude API
  const claudeStartTime = Date.now()
  const response = await createMessage({
    model,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }, 'strategy_generation')
  const latency = Date.now() - claudeStartTime

  // Parse response
  const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const thoughts = extractXML(content, 'thoughts')
  const statementsXML = extractXML(content, 'statements')
  const objectivesXML = extractXML(statementsXML, 'objectives')

  // Detect format: OKR (has <objective> tags) vs legacy (numbered list)
  const isOKRFormat = objectivesXML.includes('<objective>')

  let objectives: Objective[]
  if (isOKRFormat) {
    objectives = parseOKRObjectives(objectivesXML)
  } else {
    const objectiveStrings = objectivesXML
      .split('\n')
      .filter(line => line.trim().length > 0)
    objectives = convertLegacyObjectives(objectiveStrings)
  }

  // Parse vision - detect v4 pithy format (has <headline>) vs v3/legacy (plain text)
  const visionXML = extractXML(statementsXML, 'vision')
  const isPithyFormat = visionXML.includes('<headline>')

  let vision: string
  let visionElaboration: string | undefined
  if (isPithyFormat) {
    vision = extractXML(visionXML, 'headline')
    visionElaboration = extractXML(visionXML, 'elaboration') || undefined
  } else {
    vision = visionXML
  }

  // Parse strategy - same detection
  const strategyXML = extractXML(statementsXML, 'strategy')
  let strategy: string
  let strategyElaboration: string | undefined
  if (strategyXML.includes('<headline>')) {
    strategy = extractXML(strategyXML, 'headline')
    strategyElaboration = extractXML(strategyXML, 'elaboration') || undefined
  } else {
    strategy = strategyXML
  }

  const statements: StrategyStatements = {
    vision,
    strategy,
    objectives,
    opportunities: [],
    principles: [],
  }

  // Save trace — store fragment content as extractedContext for audit trail
  const trace = await prisma.trace.create({
    data: {
      conversationId,
      projectId,
      userId,
      extractedContext: { source: 'fragments', fragmentCount: fragments.length, fragments: fragments.map(f => f.content) } as any,
      output: statements as any,
      claudeThoughts: thoughts,
      modelUsed: model,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
    },
  })

  // Update or create GeneratedOutput
  const outputId = generatedOutputId
  if (outputId) {
    await prisma.generatedOutput.update({
      where: { id: outputId },
      data: {
        status: 'complete',
        content: statements as any,
        modelUsed: model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    })
  } else {
    // Create new (when called from non-polling context)
    const created = await prisma.generatedOutput.create({
      data: {
        projectId,
        userId,
        outputType: 'full_decision_stack',
        version: 1,
        status: 'complete',
        content: statements as any,
        modelUsed: model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        startedAt: new Date(),
      },
    })
    // Use the created ID for the return value
    ;(trace as any)._generatedOutputId = created.id
  }

  // Seed initial StrategyVersion records
  await prisma.$transaction([
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'vision',
        content: { text: vision, elaboration: visionElaboration },
        version: 1,
        createdBy: 'ai',
        sourceType: 'generation',
        sourceId: trace.id,
      },
    }),
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'strategy',
        content: { text: strategy, elaboration: strategyElaboration },
        version: 1,
        createdBy: 'ai',
        sourceType: 'generation',
        sourceId: trace.id,
      },
    }),
    ...objectives.map((obj) =>
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'objective',
          componentId: obj.id,
          content: {
            title: obj.title,
            objective: obj.objective,
            pithy: obj.pithy || obj.objective,
            keyResults: obj.keyResults,
            metric: obj.metric,
            explanation: obj.explanation,
            successCriteria: obj.successCriteria,
          } as object,
          version: 1,
          createdBy: 'ai',
          sourceType: 'generation',
          sourceId: trace.id,
        },
      })
    ),
  ])

  // Create ExtractionRun (reuses fragments loaded at top of function)
  const extractionRun = await createExtractionRun({
    projectId,
    conversationId,
    experimentVariant: experimentVariant || undefined,
    fragmentIds: fragments.map(f => f.id),
    modelUsed: model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs: latency,
    generatedOutputId: outputId || (trace as any)._generatedOutputId,
  })

  try {
    await updateExtractionRunWithSyntheses(extractionRun.id, projectId)
  } catch (err) {
    console.error('[Pipeline] Failed to update extraction run with syntheses:', err)
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'completed' },
  })

  // Log to Statsig
  if (userId) {
    await logStatsigEvent(
      userId,
      'strategy_generated',
      1,
      { variant: experimentVariant || 'unknown' }
    )
  }

  console.log(`[Pipeline] Initial generation complete in ${Date.now() - startTime}ms`)

  return {
    generatedOutputId: outputId || (trace as any)._generatedOutputId,
    traceId: trace.id,
    statements,
    version: 1,
    changeSummary: null,
  }
}
