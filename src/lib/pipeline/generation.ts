import { prisma } from '@/lib/db'
import { createMessage } from '@/lib/claude'
import { extractXML, parseOKRObjectives } from '@/lib/utils'
import { convertLegacyObjectives } from '@/lib/placeholders'
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs'
import { logStatsigEvent } from '@/lib/statsig'
import { getCurrentPrompt } from '@/lib/prompts'
import { OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT } from '@/lib/prompts/shared/objectives'
import {
  VISION_GUIDELINES, VISION_XML_FORMAT,
  STRATEGY_GUIDELINES, STRATEGY_XML_FORMAT,
} from '@/lib/prompts/shared/vision-strategy'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import type { StrategyStatements, Objective } from '@/lib/types'
import type { RefreshStrategyDeltaContract } from '@/lib/contracts/refresh-strategy'
import type { PipelineResult } from './types'

// --- Shared helpers ---

/**
 * Parse vision/strategy from XML, detecting <headline>/<elaboration> format vs plain text.
 */
function parseVisionStrategy(statementsXML: string): {
  vision: string
  visionElaboration?: string
  strategy: string
  strategyElaboration?: string
} {
  const visionXML = extractXML(statementsXML, 'vision')
  const strategyXML = extractXML(statementsXML, 'strategy')

  let vision: string
  let visionElaboration: string | undefined
  if (visionXML.includes('<headline>')) {
    vision = extractXML(visionXML, 'headline')
    visionElaboration = extractXML(visionXML, 'elaboration') || undefined
  } else {
    vision = visionXML
  }

  let strategy: string
  let strategyElaboration: string | undefined
  if (strategyXML.includes('<headline>')) {
    strategy = extractXML(strategyXML, 'headline')
    strategyElaboration = extractXML(strategyXML, 'elaboration') || undefined
  } else {
    strategy = strategyXML
  }

  return { vision, visionElaboration, strategy, strategyElaboration }
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

${VISION_GUIDELINES}

${STRATEGY_GUIDELINES}

${OBJECTIVE_GUIDELINES}

Output format:
<statements>
  ${VISION_XML_FORMAT}
  ${STRATEGY_XML_FORMAT}
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

// --- Generation functions ---

/**
 * Generate refreshed strategy from accumulated fragments + syntheses.
 * Moved from executor.ts
 */
export async function runRefreshGeneration(
  projectId: string,
  userId: string,
  model: string,
  generatedOutputId?: string
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

  const currentObjectives = (previousStatements.objectives || [])
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

  // Parse vision/strategy using shared helper (detects headline/elaboration format)
  const { vision, visionElaboration, strategy, strategyElaboration } =
    parseVisionStrategy(statementsXML)

  // Parse objectives using shared parser
  const parsedObjectives = parseOKRObjectives(objectivesXML)

  // Fallback: if no objectives parsed, preserve previous objectives
  const objectives = parsedObjectives.length > 0
    ? parsedObjectives
    : (previousStatements.objectives || [])

  const newStatements: StrategyStatements = {
    vision: vision || previousStatements.vision,
    strategy: strategy || previousStatements.strategy,
    objectives,
    opportunities: previousStatements.opportunities || [],
    principles: previousStatements.principles || [],
  }

  // Generate change summary (best-effort)
  let changeSummary: string | null = null
  try {
    const oldObjectives = (previousStatements.objectives || [])
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

  let newOutput
  if (generatedOutputId) {
    // Fire-and-forget: update existing record (created by route for polling)
    newOutput = await prisma.generatedOutput.update({
      where: { id: generatedOutputId },
      data: {
        status: 'complete',
        content: newStatements as any,
        generatedFrom: 'incremental_refresh',
        modelUsed: model,
        promptTokens: genResponse.usage.input_tokens,
        completionTokens: genResponse.usage.output_tokens,
        previousOutputId: previousOutput.id,
        changeSummary,
      },
    })
  } else {
    // Synchronous: create new record (backward compatibility)
    newOutput = await prisma.generatedOutput.create({
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
  }

  // Create StrategyVersion records for edit history
  const latestVersions = await prisma.strategyVersion.groupBy({
    by: ['componentType', 'componentId'],
    where: { projectId },
    _max: { version: true },
  })

  const getNextVersion = (type: string, componentId?: string) => {
    const match = latestVersions.find(
      v => v.componentType === type && v.componentId === (componentId ?? null)
    )
    return (match?._max.version ?? 0) + 1
  }

  await prisma.$transaction([
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'vision',
        content: { text: newStatements.vision, elaboration: visionElaboration },
        version: getNextVersion('vision'),
        createdBy: 'ai',
        sourceType: 'generation',
        sourceId: trace.id,
      },
    }),
    prisma.strategyVersion.create({
      data: {
        projectId,
        componentType: 'strategy',
        content: { text: newStatements.strategy, elaboration: strategyElaboration },
        version: getNextVersion('strategy'),
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
            omtm: obj.omtm,
            aspiration: obj.aspiration,
            explanation: obj.explanation,
            keyResults: obj.keyResults,
            metric: obj.metric,
            successCriteria: obj.successCriteria,
          } as object,
          version: getNextVersion('objective', obj.id),
          createdBy: 'ai',
          sourceType: 'generation',
          sourceId: trace.id,
        },
      })
    ),
  ])

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
 * Moved from executor.ts
 */
export async function runInitialGeneration(
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

  // Parse vision/strategy using shared helper (detects headline/elaboration format)
  const { vision, visionElaboration, strategy, strategyElaboration } =
    parseVisionStrategy(statementsXML)

  const statements: StrategyStatements = {
    vision: vision || '',
    strategy: strategy || '',
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
