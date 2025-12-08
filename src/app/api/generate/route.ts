import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { EnhancedExtractedContext, StrategyStatements, Trace } from '@/lib/types';

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

export async function POST(req: Request) {
  try {
    const { conversationId, extractedContext } = await req.json();

    if (!conversationId || !extractedContext) {
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
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const context = extractedContext as EnhancedExtractedContext;

    // Format enrichment details
    const enrichmentText = Object.entries(context.enrichment || {})
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
      })
      .join('\n');

    // Format reflective summary
    const strengthsText = (context.reflective_summary?.strengths || [])
      .map(s => `- ${s}`)
      .join('\n');

    const emergingText = (context.reflective_summary?.emerging || [])
      .map(e => `- ${e}`)
      .join('\n');

    const unexploredText = (context.reflective_summary?.unexplored || [])
      .map(u => `- ${u}`)
      .join('\n');

    const prompt = GENERATION_PROMPT
      .replace('{industry}', context.core.industry)
      .replace('{target_market}', context.core.target_market)
      .replace('{unique_value}', context.core.unique_value)
      .replace('{enrichment}', enrichmentText || 'None provided')
      .replace('{strengths}', strengthsText || 'None identified')
      .replace('{emerging}', emergingText || 'None identified')
      .replace('{unexplored}', unexploredText || 'None identified');

    // Generate strategy
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

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const thoughts = extractXML(content, 'thoughts');
    const statementsXML = extractXML(content, 'statements');

    const statements: StrategyStatements = {
      vision: extractXML(statementsXML, 'vision'),
      mission: extractXML(statementsXML, 'mission'),
      objectives: extractXML(statementsXML, 'objectives')
        .split('\n')
        .filter(line => line.trim().length > 0)
    };

    // Save trace
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

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

    return NextResponse.json({
      traceId: trace.id,
      thoughts,
      statements,
    });
  } catch (error) {
    console.error('Generate strategy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy' },
      { status: 500 }
    );
  }
}
