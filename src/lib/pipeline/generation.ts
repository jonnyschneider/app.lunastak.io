import { prisma } from '@/lib/db'
import { createMessage } from '@/lib/claude'
import { extractXML, parseOKRObjectives } from '@/lib/utils'
import { convertLegacyObjectives } from '@/lib/placeholders'
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs'
import { logStatsigEvent } from '@/lib/statsig'
import { notifySlackStrategyGenerated } from '@/lib/notifications'
import { getCurrentPrompt } from '@/lib/prompts'
import { OBJECTIVE_GUIDELINES, OBJECTIVE_XML_FORMAT } from '@/lib/prompts/shared/objectives'
import {
  VISION_GUIDELINES, VISION_XML_FORMAT,
  STRATEGY_GUIDELINES, STRATEGY_XML_FORMAT,
} from '@/lib/prompts/shared/vision-strategy'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import type { StrategyStatements, Objective, Opportunity, SuccessMetric } from '@/lib/types'
import type { RefreshStrategyDeltaContract } from '@/lib/contracts/refresh-strategy'
import type { OpportunityGenerationOutputContract } from '@/lib/contracts/opportunity-generation'
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
): Promise<NonNullable<PipelineResult['generation']>> {
  // Load previous strategy from Decision Stack
  const { getStrategyStatements: getPrevStatements } = await import('@/lib/decision-stack')
  const previousStatements = await getPrevStatements(projectId)

  if (!previousStatements) {
    throw new Error('No previous strategy found for refresh')
  }

  // Get dimensional syntheses
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId, fragmentCount: { gt: 0 } },
    orderBy: { fragmentCount: 'desc' },
  })

  // Get all active fragments for the snapshot, split into existing vs new
  const allFragments = await prisma.fragment.findMany({
    where: { projectId, status: 'active' },
    select: { content: true, contentType: true, createdAt: true },
    orderBy: { capturedAt: 'desc' },
  })

  // Split by latest snapshot timestamp (when last generation completed)
  const latestSnapshot = await prisma.decisionStackSnapshot.findFirst({
    where: { projectId, trigger: { startsWith: 'post_' } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  const cutoff = latestSnapshot?.createdAt || new Date(0)
  const newFragments = allFragments.filter(f => f.createdAt > cutoff)
  const existingFragments = allFragments.filter(f => f.createdAt <= cutoff)

  // Get removed fragments (archived since last generation)
  const removedFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: { in: ['archived', 'soft_deleted'] },
      updatedAt: { gt: cutoff },
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
      extractedContext: {
        source: 'refresh',
        existingFragments: existingFragments.map(f => ({ content: f.content, contentType: f.contentType })),
        newFragments: newFragments.map(f => ({ content: f.content, contentType: f.contentType })),
        removedCount: removedFragments.length,
      } as any,
      output: newStatements as any,
      claudeThoughts: `Incremental refresh based on ${delta.newFragmentCount} new and ${delta.removedFragmentCount} removed fragments.`,
      modelUsed: model,
      totalTokens: genResponse.usage.input_tokens + genResponse.usage.output_tokens,
      promptTokens: genResponse.usage.input_tokens,
      completionTokens: genResponse.usage.output_tokens,
      latencyMs: 0,
    },
  })

  // --- Write to Decision Stack tables ---
  const { writeStrategyToStack, captureSnapshot, setGenerationStatus } = await import('@/lib/decision-stack')

  // Pre-snapshot (current state before refresh)
  await captureSnapshot(projectId, 'pre_refresh')

  // Write refreshed strategy to stack
  await writeStrategyToStack(projectId, newStatements)

  // Post-snapshot with metadata
  await captureSnapshot(projectId, 'post_refresh', {
    modelUsed: model,
    promptTokens: genResponse.usage.input_tokens,
    completionTokens: genResponse.usage.output_tokens,
    changeSummary: changeSummary ?? undefined,
  })

  // Clear generation status
  await setGenerationStatus(projectId, null)

  console.log('[Pipeline] Refresh generation complete for project:', projectId)

  // Notify Slack (fire-and-forget)
  prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    .then(u => { if (u?.email) notifySlackStrategyGenerated(u.email, 'refresh') })

  return {
    traceId: trace.id,
    statements: newStatements,
    changeSummary,
  }
}

/**
 * Generate initial strategy from extracted context.
 * Moved from executor.ts
 */
export async function runInitialGeneration(
  projectId: string,
  conversationId: string | null,
  userId: string | null,
  experimentVariant: string | null,
  model: string
): Promise<NonNullable<PipelineResult['generation']>> {
  const startTime = Date.now()

  // Load fragments from DB (created earlier in the pipeline)
  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: 'active' },
    select: { id: true, content: true, contentType: true },
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
  // When generating from knowledge (no conversation), create a synthetic conversation for the trace
  let traceConversationId = conversationId
  if (!traceConversationId) {
    const syntheticConvo = await prisma.conversation.create({
      data: {
        projectId,
        userId,
        status: 'completed',
        title: 'Generated from knowledgebase',
        isInitialConversation: true,
      },
    })
    traceConversationId = syntheticConvo.id
  }

  const trace = await prisma.trace.create({
    data: {
      conversationId: traceConversationId,
      projectId,
      userId,
      extractedContext: {
        source: conversationId ? 'fragments' : 'knowledge-import',
        fragments: fragments.map(f => ({ content: f.content, contentType: f.contentType })),
      } as any,
      output: statements as any,
      claudeThoughts: thoughts,
      modelUsed: model,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
    },
  })

  // --- Write to Decision Stack tables ---
  const { writeStrategyToStack, captureSnapshot, setGenerationStatus } = await import('@/lib/decision-stack')

  // Pre-snapshot (empty state before first generation)
  await captureSnapshot(projectId, 'pre_generation')

  // Write to DecisionStack + components
  await writeStrategyToStack(projectId, statements)

  // Post-snapshot with metadata
  await captureSnapshot(projectId, 'post_generation', {
    modelUsed: model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs: latency,
  })

  // Clear generation status
  await setGenerationStatus(projectId, null)

  // Create ExtractionRun (reuses fragments loaded at top of function)
  const extractionRun = await createExtractionRun({
    projectId,
    conversationId: traceConversationId,
    experimentVariant: experimentVariant || undefined,
    fragmentIds: fragments.map(f => f.id),
    modelUsed: model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs: latency,
  })

  try {
    await updateExtractionRunWithSyntheses(extractionRun.id, projectId)
  } catch (err) {
    console.error('[Pipeline] Failed to update extraction run with syntheses:', err)
  }

  // Update conversation status (skip if no real conversation)
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    })
  }

  // Log to Statsig
  if (userId) {
    await logStatsigEvent(
      userId,
      'strategy_generated',
      1,
      { variant: experimentVariant || 'unknown' }
    )

    // Notify Slack (fire-and-forget)
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      .then(u => { if (u?.email) notifySlackStrategyGenerated(u.email, 'initial') })
  }

  console.log(`[Pipeline] Initial generation complete in ${Date.now() - startTime}ms`)

  return {
    traceId: trace.id,
    statements,
    changeSummary: null,
  }
}

// --- Opportunity Generation ---

const OPPORTUNITY_GENERATION_PROMPT = `You are Luna, a strategic AI coach. Generate actionable opportunities based on the user's strategic direction and accumulated knowledge.

## Strategic Direction
Vision: {vision}
Strategy: {strategy}
Objectives:
{objectives}

## Strategic Context (Dimensional Syntheses)
{dimensional_summaries}

## Knowledge Base (Active Fragments)
{fragments_content}

---

Generate 3-5 strategic opportunities. Each opportunity must:
- Map to one or more existing objectives (by ID)
- Have a clear title and description (2-3 sentences)
- Include exactly ONE success metric with a belief hypothesis

The UI renders the belief as: "We believe [action] will [outcome]"
So action and outcome must read naturally after those lead-in words. Keep each to 8-20 words.

BAD action: "We believe systematizing cultural transmission through structured onboarding and manager development will preserve pricing discipline"
GOOD action: "codifying the cultural playbook into manager onboarding"

BAD outcome: "Store managers demonstrate consistent cultural fluency in member-first trade-offs, independent of direct mentorship"
GOOD outcome: "preserve pricing discipline as the org scales beyond founder reach"

Success metric fields must be concise — communicating intent, not forensic precision.
- signal: ONE metric name (5-15 words). NOT a comma-separated list.
- baseline: Current state in 5-15 words
- target: Desired state in 5-15 words

Output format:
<opportunities>
  <opportunity>
    <title>Short initiative name</title>
    <description>What we're doing and why</description>
    <objective_ids>obj-1, obj-2</objective_ids>
    <metrics>
      <metric>
        <action>completing phrase after "We believe" (8-20 words, no leading "We believe")</action>
        <outcome>completing phrase after "will" (8-20 words, no leading "will")</outcome>
        <signal>one metric name</signal>
        <baseline>current state</baseline>
        <target>desired state</target>
      </metric>
    </metrics>
  </opportunity>
</opportunities>`

/**
 * Generate opportunities from fragments + syntheses + decision stack.
 */
export async function runOpportunityGeneration(
  projectId: string,
  userId: string | null,
  model: string,
): Promise<void> {
  // Load the current Decision Stack
  const { getStrategyStatements: getStatements } = await import('@/lib/decision-stack')
  const statements = await getStatements(projectId)

  if (!statements) {
    throw new Error('No decision stack found — generate Direction first')
  }

  // Load dimensional syntheses
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId, fragmentCount: { gt: 0 } },
    orderBy: { fragmentCount: 'desc' },
  })

  // Load active fragments
  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: 'active' },
    select: { content: true, contentType: true },
    orderBy: { capturedAt: 'desc' },
    take: 100,
  })

  // Build prompt
  const objectivesText = (statements.objectives || [])
    .map((o, i) => `${i + 1}. [${o.id}] ${o.title || o.objective || o.pithy} — ${o.explanation || ''}`)
    .join('\n')

  const dimensionalSummaries = syntheses
    .map(s => {
      const context = DIMENSION_CONTEXT[s.dimension as Tier1Dimension]
      const name = context?.name || s.dimension
      return `### ${name}\n${s.summary || 'No summary yet'}`
    })
    .join('\n\n')

  const fragmentsContent = fragments.length > 0
    ? fragments.map(f => `- [${f.contentType}] ${f.content}`).join('\n')
    : 'No fragments yet.'

  const prompt = OPPORTUNITY_GENERATION_PROMPT
    .replace('{vision}', statements.vision)
    .replace('{strategy}', statements.strategy)
    .replace('{objectives}', objectivesText)
    .replace('{dimensional_summaries}', dimensionalSummaries)
    .replace('{fragments_content}', fragmentsContent)

  // Call Claude
  const response = await createMessage({
    model,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }, 'opportunity_generation')

  const content = response.content[0]?.type === 'text' ? response.content[0].text : ''

  // Parse opportunities from XML
  const opportunities = parseOpportunitiesXML(content)

  // --- Write to Decision Stack tables ---
  const { writeOpportunitiesToStack, captureSnapshot, setGenerationStatus } = await import('@/lib/decision-stack')

  // Pre-snapshot
  await captureSnapshot(projectId, 'pre_opportunities')

  // Write opportunities to stack
  await writeOpportunitiesToStack(projectId, opportunities)

  // Post-snapshot with metadata
  await captureSnapshot(projectId, 'post_opportunities', {
    modelUsed: model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  })

  // Clear generation status
  await setGenerationStatus(projectId, null)

  console.log(`[Pipeline] Opportunity generation complete: ${opportunities.length} opportunities for project ${projectId}`)
}

/**
 * Parse opportunities from Claude's XML response.
 */
function parseOpportunitiesXML(content: string): Opportunity[] {
  const opportunitiesXML = extractXML(content, 'opportunities')
  if (!opportunitiesXML) return []

  const opportunityBlocks = opportunitiesXML.split('<opportunity>').slice(1)

  return opportunityBlocks.map((block, index) => {
    const title = extractXML(block, 'title')
    const description = extractXML(block, 'description')
    const objectiveIdsRaw = extractXML(block, 'objective_ids')
    const objectiveIds = objectiveIdsRaw
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)

    // Parse metrics
    const metricsXML = extractXML(block, 'metrics')
    const metricBlocks = metricsXML.split('<metric>').slice(1)
    const successMetrics: SuccessMetric[] = metricBlocks.map((mb, mi) => ({
      id: `opp-${index + 1}-metric-${mi + 1}`,
      belief: {
        action: extractXML(mb, 'action'),
        outcome: extractXML(mb, 'outcome'),
      },
      signal: extractXML(mb, 'signal'),
      baseline: extractXML(mb, 'baseline'),
      target: extractXML(mb, 'target'),
    }))

    return {
      id: `opp-${Date.now()}-${index + 1}`,
      title,
      description,
      objectiveIds,
      successMetrics,
      status: 'draft' as const,
    }
  })
}
