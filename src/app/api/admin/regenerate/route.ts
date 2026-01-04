import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { StrategyStatements, ExtractedContextVariant, isEmergentContext } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { logStatsigEvent } from '@/lib/statsig';

export const maxDuration = 60;

const GENERATION_PROMPT = `Generate compelling strategy statements based on the comprehensive business context provided.

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

const EMERGENT_GENERATION_PROMPT = `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging patterns:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific themes that emerged</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;

export async function POST(req: Request) {
  try {
    const { traceId } = await req.json();

    if (!traceId) {
      return NextResponse.json(
        { error: 'traceId is required' },
        { status: 400 }
      );
    }

    console.log(`[Regenerate API] Processing trace: ${traceId}`);

    // Load original trace
    const originalTrace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: { conversation: true },
    });

    if (!originalTrace) {
      return NextResponse.json(
        { error: 'Trace not found' },
        { status: 404 }
      );
    }

    const context = originalTrace.extractedContext as unknown as ExtractedContextVariant;
    let prompt: string;

    // Build prompt based on context type
    if (isEmergentContext(context)) {
      const themesText = context.themes
        .map(theme => `${theme.theme_name}:\n${theme.content}`)
        .join('\n\n');

      const strengthsText = (context.reflective_summary?.strengths || [])
        .map(s => `- ${s}`)
        .join('\n');

      const emergingText = (context.reflective_summary?.emerging || [])
        .map(e => `- ${e}`)
        .join('\n');

      const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
        .map((opp: string) => `- ${opp}`)
        .join('\n');

      prompt = EMERGENT_GENERATION_PROMPT
        .replace('{themes}', themesText)
        .replace('{strengths}', strengthsText || 'None identified')
        .replace('{emerging}', emergingText || 'None identified')
        .replace('{unexplored}', opportunitiesText || 'None identified');
    } else {
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

    console.log('[Regenerate API] Calling Claude API...');
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7
    });

    const latency = Date.now() - startTime;
    console.log(`[Regenerate API] Claude responded in ${latency}ms`);

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const thoughts = extractXML(content, 'thoughts');
    const statementsXML = extractXML(content, 'statements');

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

    // Save new trace
    const newTrace = await prisma.trace.create({
      data: {
        conversationId: originalTrace.conversationId,
        userId: originalTrace.userId,
        extractedContext: originalTrace.extractedContext as any,
        output: statements as any,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    });

    console.log(`[Regenerate API] Created new trace: ${newTrace.id}`);

    // Log to Statsig for experiment metrics
    if (originalTrace.conversation?.userId) {
      await logStatsigEvent(
        originalTrace.conversation.userId,
        'strategy_generated',
        1,
        { variant: originalTrace.conversation.experimentVariant || 'unknown' }
      );
    }

    return NextResponse.json({
      success: true,
      originalTraceId: traceId,
      newTraceId: newTrace.id,
      statements,
      thoughts,
      url: `/strategy/${newTrace.id}`
    });

  } catch (error) {
    console.error('[Regenerate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate strategy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
