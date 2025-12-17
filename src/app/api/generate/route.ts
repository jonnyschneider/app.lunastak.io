import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { EnhancedExtractedContext, StrategyStatements, Trace, ExtractedContextVariant, isEmergentContext } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';

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
- Mission: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific insights from the context</thoughts>
<statements>
  <vision>The vision statement</vision>
  <mission>The mission statement</mission>
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
- Mission: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific themes that emerged</thoughts>
<statements>
  <vision>The vision statement</vision>
  <mission>The mission statement</mission>
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
    const { conversationId, extractedContext } = await req.json();
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
      mission: extractXML(statementsXML, 'mission'),
      objectives: convertLegacyObjectives(objectiveStrings),
      initiatives: [], // Will be generated as placeholders in UI
      principles: []   // Will be generated as placeholders in UI
    };

    // Save trace
    console.log('[Generate API] Saving trace to database...');
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId: conversation.userId,
        extractedContext: extractedContext as any,
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

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

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
