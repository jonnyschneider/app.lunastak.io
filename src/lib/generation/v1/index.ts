// src/lib/generation/v1/index.ts
/**
 * Generation Logic v1 - Archived 2026-01-31
 *
 * This is the synchronous generation implementation that blocks while processing.
 * Archived for backtesting and comparison with future versions.
 *
 * Key characteristics:
 * - Streaming response with progress updates
 * - Two generation approaches: emergent (themes-only) and prescriptive (3-field)
 * - Creates Trace, GeneratedOutput, and ExtractionRun records
 *
 * Contract: Returns GenerationOutputContract (see src/lib/contracts/generation.ts)
 */

import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { StrategyStatements, ExtractedContextVariant, isEmergentContext } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs';
import { logStatsigEvent } from '@/lib/statsig';

// Progress step type for streaming updates
export type GenerationProgressStep =
  | 'preparing'
  | 'generating'
  | 'saving'
  | 'complete'
  | 'error';

export interface GenerationProgressUpdate {
  step: GenerationProgressStep;
  data?: {
    traceId?: string;
    thoughts?: string;
    statements?: StrategyStatements;
  };
  error?: string;
}

// Frozen emergent generation prompt (v2-themes-only, archived for backtesting)
export const EMERGENT_GENERATION_PROMPT_V2 = `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

Your task:
1. Analyze these themes to identify what's strong, what's emerging, and what needs exploration
2. Generate a cohesive strategy that builds on these themes

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your analysis of the themes - what's strong, what's emerging, what needs exploration. Reference specific themes.</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

// Prescriptive generation prompt (baseline-v1)
export const GENERATION_PROMPT = `Generate compelling strategy statements based on the comprehensive business context provided.

CORE CONTEXT:
Industry: {industry}
Target Market: {target_market}
Unique Value: {unique_value}

ENRICHMENT DETAILS:
{enrichment}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging themes:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the core context as foundation
- Leverage enrichment details to add specificity and differentiation
- Incorporate the strengths and emerging themes identified
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific insights from the context</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

export interface GenerationOptions {
  conversationId: string;
  extractedContext: ExtractedContextVariant;
  dimensionalCoverage?: any;
}

export interface GenerationResult {
  traceId: string;
  thoughts: string;
  statements: StrategyStatements;
}

/**
 * Perform generation synchronously (blocking).
 * This is the v1 implementation archived for backtesting.
 */
export async function performGeneration(
  options: GenerationOptions,
  sendProgress: (update: GenerationProgressUpdate) => void
): Promise<GenerationResult> {
  const { conversationId, extractedContext, dimensionalCoverage } = options;

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Step 1: Prepare context
  sendProgress({ step: 'preparing' });

  console.log('[Generate v1] Preparing context...');
  const context = extractedContext as ExtractedContextVariant;

  let prompt: string;

  if (isEmergentContext(context)) {
    // Emergent generation - use frozen v2 prompt for backtesting
    const themesText = context.themes
      .map(theme => `${theme.theme_name}:\n${theme.content}`)
      .join('\n\n');

    prompt = EMERGENT_GENERATION_PROMPT_V2.replace('{themes}', themesText);
  } else {
    // Prescriptive generation (baseline-v1)
    const enrichmentText = Object.entries(context.enrichment || {})
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
      })
      .join('\n');

    const strengthsText = (context.reflective_summary?.strengths || [])
      .map(s => `- ${s}`)
      .join('\n');

    const emergingText = (context.reflective_summary?.emerging || [])
      .map(e => `- ${e}`)
      .join('\n');

    const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
      .map((opp: string) => `- ${opp}`)
      .join('\n');

    prompt = GENERATION_PROMPT
      .replace('{industry}', context.core.industry)
      .replace('{target_market}', context.core.target_market)
      .replace('{unique_value}', context.core.unique_value)
      .replace('{enrichment}', enrichmentText || 'None provided')
      .replace('{strengths}', strengthsText || 'None identified')
      .replace('{emerging}', emergingText || 'None identified')
      .replace('{unexplored}', opportunitiesText || 'None identified');
  }

  // Step 2: Generate strategy
  sendProgress({ step: 'generating' });

  console.log('[Generate v1] Calling Claude API...');
  console.log('[Generate v1] Prompt length:', prompt.length, 'characters');
  const startTime = Date.now();
  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.7
  }, 'strategy_generation');
  const latency = Date.now() - startTime;
  console.log(`[Generate v1] Claude API responded in ${latency}ms`);

  const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

  const thoughts = extractXML(content, 'thoughts');
  const statementsXML = extractXML(content, 'statements');

  // Extract objectives as strings and convert to new format
  const objectiveStrings = extractXML(statementsXML, 'objectives')
    .split('\n')
    .filter(line => line.trim().length > 0);

  const statements: StrategyStatements = {
    vision: extractXML(statementsXML, 'vision'),
    strategy: extractXML(statementsXML, 'strategy'),
    objectives: convertLegacyObjectives(objectiveStrings),
    opportunities: [],
    principles: []
  };

  // Step 3: Save results
  sendProgress({ step: 'saving' });

  // Save trace (legacy - keeping for backward compatibility)
  console.log('[Generate v1] Saving trace to database...');
  const trace = await prisma.trace.create({
    data: {
      conversationId,
      projectId: conversation.projectId,
      userId: conversation.userId,
      extractedContext: extractedContext as any,
      dimensionalCoverage: dimensionalCoverage as any,
      output: statements as any,
      claudeThoughts: thoughts,
      modelUsed: CLAUDE_MODEL,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
    },
  });
  console.log('[Generate v1] Trace saved with ID:', trace.id);

  // Write to Decision Stack
  if (conversation.projectId) {
    try {
      const { writeStrategyToStack, captureSnapshot } = await import('@/lib/decision-stack')
      await captureSnapshot(conversation.projectId, 'pre_generation')
      await writeStrategyToStack(conversation.projectId, statements)
      await captureSnapshot(conversation.projectId, 'post_generation', {
        modelUsed: CLAUDE_MODEL,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      })
      console.log('[Generate v1] Decision Stack written for project:', conversation.projectId)

      // Get fragment IDs from this conversation
      const fragments = await prisma.fragment.findMany({
        where: { conversationId },
        select: { id: true }
      });
      const fragmentIds = fragments.map(f => f.id);

      // Create ExtractionRun for evaluation
      const extractionRun = await createExtractionRun({
        projectId: conversation.projectId,
        conversationId,
        experimentVariant: conversation.experimentVariant || undefined,
        fragmentIds,
        modelUsed: CLAUDE_MODEL,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      });
      console.log('[Generate v1] ExtractionRun saved with ID:', extractionRun.id);

      // Update with syntheses
      try {
        await updateExtractionRunWithSyntheses(extractionRun.id, conversation.projectId);
      } catch (err) {
        console.error('[Generate v1] Failed to update extraction run with syntheses:', err);
      }
    } catch (error) {
      console.error('[Generate v1] Failed to write Decision Stack/ExtractionRun:', error);
    }
  }

  // Update conversation status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'completed' },
  });

  // Log to Statsig for experiment metrics
  if (conversation.userId) {
    await logStatsigEvent(
      conversation.userId,
      'strategy_generated',
      1,
      { variant: conversation.experimentVariant || 'unknown' }
    );
  }

  return { traceId: trace.id, thoughts, statements };
}
