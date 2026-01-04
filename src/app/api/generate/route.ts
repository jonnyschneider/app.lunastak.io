import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { EnhancedExtractedContext, StrategyStatements, Trace, ExtractedContextVariant, isEmergentContext } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs';
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
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started');

  try {
    const { conversationId, extractedContext, dimensionalCoverage } = await req.json();
    console.log('[Generate API] Parsed request body, conversationId:', conversationId);

    if (!conversationId || !extractedContext) {
      console.error('[Generate API] Missing required fields');
      return NextResponse.json(
        { error: 'conversationId and extractedContext are required' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      console.error('[Generate API] Conversation not found:', conversationId);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log('[Generate API] Conversation found, preparing context...');
    const context = extractedContext as ExtractedContextVariant;

    let prompt: string;

    if (isEmergentContext(context)) {
      // Emergent generation
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

    // Generate strategy
    console.log('[Generate API] Calling Claude API...');
    console.log('[Generate API] Prompt length:', prompt.length, 'characters');
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
    console.log(`[Generate API] Claude API responded in ${latency}ms`);

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
      opportunities: [], // Will be generated as placeholders in UI
      principles: []   // Will be generated as placeholders in UI
    };

    // Save trace (legacy - keeping for backward compatibility)
    console.log('[Generate API] Saving trace to database...');
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId: conversation.userId,
        extractedContext: extractedContext as any,
        dimensionalCoverage: dimensionalCoverage as any, // [E2] Store dimensional coverage
        output: statements as any,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    });
    console.log('[Generate API] Trace saved with ID:', trace.id);

    // Create GeneratedOutput (new schema)
    let generatedOutput = null;
    let extractionRun = null;

    console.log('[Generate API] Checking projectId:', conversation.projectId);
    if (conversation.projectId) {
      try {
        console.log('[Generate API] Creating GeneratedOutput for project:', conversation.projectId);
        generatedOutput = await prisma.generatedOutput.create({
          data: {
            projectId: conversation.projectId,
            userId: conversation.userId,
            outputType: 'full_decision_stack',
            version: 1,
            content: statements as any,
            modelUsed: CLAUDE_MODEL,
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            latencyMs: latency,
          }
        });
        console.log('[Generate API] GeneratedOutput saved with ID:', generatedOutput.id);

        // Get fragment IDs from this conversation
        const fragments = await prisma.fragment.findMany({
          where: { conversationId },
          select: { id: true }
        });
        const fragmentIds = fragments.map(f => f.id);

        // Create ExtractionRun for evaluation
        extractionRun = await createExtractionRun({
          projectId: conversation.projectId,
          conversationId,
          experimentVariant: conversation.experimentVariant || undefined,
          fragmentIds,
          modelUsed: CLAUDE_MODEL,
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          latencyMs: latency,
          generatedOutputId: generatedOutput.id
        });
        console.log('[Generate API] ExtractionRun saved with ID:', extractionRun.id);

        // Update with syntheses after (async)
        updateExtractionRunWithSyntheses(extractionRun.id, conversation.projectId).catch(err => {
          console.error('[Generate API] Failed to update extraction run with syntheses:', err);
        });
      } catch (error) {
        console.error('[Generate API] Failed to create GeneratedOutput/ExtractionRun:', error);
        // Continue - don't fail generation if new schema writes fail
      }
    }

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

    // Log to Statsig for experiment metrics
    await logStatsigEvent(
      conversation.userId,
      'strategy_generated',
      1,
      { variant: conversation.experimentVariant }
    );

    const totalTime = Date.now() - requestStartTime;
    console.log(`[Generate API] Request completed successfully in ${totalTime}ms`);

    return NextResponse.json({
      traceId: trace.id,
      thoughts,
      statements,
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[Generate API] Error after ${totalTime}ms:`, error);
    console.error('[Generate API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate strategy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
