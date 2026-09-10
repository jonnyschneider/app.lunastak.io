import { prisma } from '@/lib/db'
import { createMessage } from '@/lib/claude'
import { extractXML, parseOKRObjectives, extractObjectivesXML } from '@/lib/utils'
import { convertLegacyObjectives } from '@/lib/placeholders'
import { logStatsigEvent } from '@/lib/statsig'
import { notifySlackStrategyGenerated } from '@/lib/notifications'
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions'
import type { StrategyStatements, Objective, Opportunity, SuccessMetric } from '@/lib/types'
import type { RefreshStrategyDeltaContract } from '@/lib/contracts/refresh-strategy'
import type { OpportunityGenerationOutputContract } from '@/lib/contracts/opportunity-generation'
import type { PipelineResult } from './types'
import { extractText } from '@/lib/extract-text';
import { renderEvidence } from '@/lib/prompts/shared/evidence'

/**
 * Initial strategy generation. Inlined 2026-08-27 from the retired prompt
 * registry entry `v4-pithy-statements` (2026-02-11), its only adopter.
 * See docs/retired-prompt-registry.md; recovery tag `prompt-registry-final`.
 */
// --- Shared helpers ---

/**
 * Extract a LEAF field — one whose value is prose and can never legitimately contain markup.
 *
 * ⚠ Real failure, 2026-09-10 (demo-fixture rerun, seen in 2 of 5 generations). The model
 * mis-typed a closing tag: `<headline>Make chips for everyone…</headml>`. `dropStrayClosingTags`
 * correctly removed the unmatched `</headml>`, which left `<headline>` open with no closer, so
 * `extractXML`'s tolerant recovery path walked forward past the end of the headline and returned
 * the elaboration with it — raw `<elaboration>` tags and all. That string was persisted straight
 * into `DecisionStack.strategy` and rendered to the user.
 *
 * This is the exact failure class a7865ad was written to prevent ("stray closing tags leaked raw
 * XML into generated prose"), arriving from the opposite direction: that fix handles an unmatched
 * CLOSER, and a mis-typed closer also creates an unmatched OPENER.
 *
 * A leaf value ends at the first tag that follows it, so cut there. Recovery must never widen a
 * leaf into its siblings. Well-formed input is unaffected — there is no `<` to cut at.
 */
function extractLeaf(region: string, tag: string): string {
  const value = extractXML(region, tag)
  const firstTag = value.search(/<\/?[a-zA-Z]/)
  return (firstTag === -1 ? value : value.slice(0, firstTag)).trim()
}

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
    vision = extractLeaf(visionXML, 'headline')
    visionElaboration = extractLeaf(visionXML, 'elaboration') || undefined
  } else {
    vision = visionXML
  }

  let strategy: string
  let strategyElaboration: string | undefined
  if (strategyXML.includes('<headline>')) {
    strategy = extractLeaf(strategyXML, 'headline')
    strategyElaboration = extractLeaf(strategyXML, 'elaboration') || undefined
  } else {
    strategy = strategyXML
  }

  return { vision, visionElaboration, strategy, strategyElaboration }
}

// --- Prompts for refresh strategy ---

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

Write 2-4 plain text sentences explaining what changed and why. Be specific. Do NOT use markdown formatting (no bold, italic, bullets, or headers). If nothing meaningful changed, say "No significant changes - strategy remains aligned with current insights."`

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
  // Payload only — instructions and output format are the stage's system block.
  const updatePrompt = [
    '## Current Strategy',
    `Vision: ${previousStatements.vision}`,
    `Strategy: ${previousStatements.strategy}`,
    'Objectives:',
    currentObjectives,
    '',
    '## Strategic Context (Dimensional Syntheses)',
    dimensionalSummaries,
    '',
    "## What's New (since last strategy)",
    newFragmentsContent,
    '',
    "## What's Been Removed",
    archivedContent,
  ].join('\n')

  const genResponse = await createMessage({
    messages: [{ role: 'user', content: updatePrompt }],
    temperature: 0.7,
  }, 'refresh_strategy_generation', userId)

  const genContent = extractText(genResponse)

  const statementsXML = extractXML(genContent, 'statements')
  const objectivesXML = extractObjectivesXML(statementsXML)

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
    visionExplainer: visionElaboration ?? previousStatements.visionExplainer,
    strategy: strategy || previousStatements.strategy,
    strategyExplainer: strategyElaboration ?? previousStatements.strategyExplainer,
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
      messages: [{ role: 'user', content: summaryPrompt }],
      temperature: 0.5,
    }, 'refresh_strategy_summary', userId)

    changeSummary = extractText(summaryResponse).trim() || null
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
      modelUsed: genResponse.model,
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
    modelUsed: genResponse.model,
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
    select: {
      id: true,
      content: true,
      contentType: true,
      // Verbatim spans, ordinal order — rendered into the payload as the user's own
      // words (§18/§19 of the ground-truth preflight design). Initial generation reads
      // fragments, never syntheses, so this is the only route by which evidence reaches
      // the first strategy a user sees.
      evidence: {
        select: { text: true, verification: true },
        orderBy: { ordinal: 'asc' },
      },
    },
    orderBy: { capturedAt: 'desc' },
  })

  if (fragments.length === 0) {
    throw new Error('No active fragments found for initial generation')
  }

  // Build prompt from fragments — same data as extractedContext.themes, read from DB
  // `renderEvidence` returns '' when a fragment has no usable evidence — which is nearly
  // every production fragment, and must stay byte-identical to the pre-evidence payload.
  // No `### Fragment N` headers or `---` rules here, unlike the synthesis path: the
  // evidence block is self-delimiting, and adding delimiters would be a second
  // simultaneous change confounding the measurement this is built for.
  const themesText = fragments
    .map(f => `${f.content}${renderEvidence(f)}`)
    .join('\n\n')
  // Payload only — framing, tone and output format are the stage's system block.
  const prompt = `EMERGENT THEMES:\n${themesText}`

  // Call Claude API
  const claudeStartTime = Date.now()
  const response = await createMessage({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }, 'strategy_generation', userId)
  const latency = Date.now() - claudeStartTime

  // Parse response
  const content = extractText(response)
  const thoughts = extractXML(content, 'thoughts')
  const statementsXML = extractXML(content, 'statements')
  const objectivesXML = extractObjectivesXML(statementsXML)

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
    visionExplainer: visionElaboration,
    strategy: strategy || '',
    strategyExplainer: strategyElaboration,
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
      modelUsed: response.model,
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
    modelUsed: response.model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs: latency,
  })

  // Clear generation status
  await setGenerationStatus(projectId, null)

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
    select: {
      content: true,
      contentType: true,
      // Verbatim spans, ordinal order — rendered into the payload as the user's own
      // words (§18/§20 of the ground-truth preflight design). §2 traced the fabricated
      // NUMBERS (`8–15 hours`, `30–50%`, `Baseline: 0%`) to this stage alone: a metric
      // can only be grounded in the sentence the user actually said it in. The
      // dimensional summaries below already carry evidence in prose (452afd5); these are
      // the spans themselves, which is a different thing to hand a metric-writing step.
      evidence: {
        select: { text: true, verification: true },
        orderBy: { ordinal: 'asc' },
      },
    },
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

  // `renderEvidence` returns '' when a fragment has no usable evidence — which is nearly
  // every production fragment, and must stay byte-identical to the pre-evidence payload.
  // The block is multi-line and sits inside a bullet list; it is self-delimiting (labelled
  // header plus `>` markers), and adding list-aware indentation would reword measured
  // output, so it is left as the other two call sites render it.
  // Bullets join with a single newline, so a multi-line evidence block would run straight into the
  // next `- [type]` bullet with nothing between them — the weakest boundary of the three call
  // sites. Fragments carrying evidence therefore get a blank line after them. This changes the
  // JOIN, not the measured block itself (§18), and only for fragments that actually have evidence,
  // so the no-evidence payload stays byte-identical.
  const fragmentsContent = fragments.length > 0
    ? fragments
        .map(f => {
          const block = renderEvidence(f)
          return `- [${f.contentType}] ${f.content}${block}${block ? '\n' : ''}`
        })
        .join('\n')
        // the separator is only needed BETWEEN bullets; the last one must not trail
        .trimEnd()
    : 'No fragments yet.'

  // Payload only — instructions and output format are the stage's system block.
  const prompt = [
    '## Strategic Direction',
    `Vision: ${statements.vision}`,
    `Strategy: ${statements.strategy}`,
    'Objectives:',
    objectivesText,
    '',
    '## Strategic Context (Dimensional Syntheses)',
    dimensionalSummaries,
    '',
    '## Knowledge Base (Active Fragments)',
    fragmentsContent,
  ].join('\n')

  // Call Claude
  const response = await createMessage({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }, 'opportunity_generation', userId)

  const content = extractText(response)

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
    modelUsed: response.model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  })

  // Clear generation status
  await setGenerationStatus(projectId, null)

  console.log(`[Pipeline] Opportunity generation complete: ${opportunities.length} opportunities for project ${projectId}`)

  // Notify Slack (fire-and-forget)
  if (userId) {
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      .then(u => {
        if (u?.email) {
          const { notifySlackOpportunitiesGenerated } = require('@/lib/notifications')
          notifySlackOpportunitiesGenerated(u.email, opportunities.length)
        }
      })
  }
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
