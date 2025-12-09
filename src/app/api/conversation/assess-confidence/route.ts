import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ConfidenceLevel } from '@/lib/types';

export const maxDuration = 60;

const CONFIDENCE_ASSESSMENT_PROMPT = `Evaluate this business strategy conversation for readiness to generate quality strategy output.

Conversation:
{conversation}

Assessment Criteria:

1. COVERAGE - Has the conversation touched these key dimensions?
   - Customer/market understanding (who, what problem)
   - Value proposition (why you, differentiation)
   - Context (industry, competitive landscape)

2. SPECIFICITY - Are responses concrete enough to work with?
   - Enough concrete detail to anchor strategy
   - Clear enough to identify what's uncertain/unexplored
   - Sufficient for generating strategy + highlighting development opportunities

Remember: This is a development tool. We need enough to work with, not perfect knowledge.

Return your assessment:
<assessment>
  <confidence>HIGH or MEDIUM or LOW</confidence>
  <reasoning>Brief explanation (1-2 sentences)</reasoning>
</assessment>`;

export async function POST(req: Request) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Assess confidence
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const assessmentXML = extractXML(content, 'assessment');
    const confidence = extractXML(assessmentXML, 'confidence') as ConfidenceLevel;
    const reasoning = extractXML(assessmentXML, 'reasoning');

    return NextResponse.json({
      confidenceScore: confidence || 'MEDIUM',
      confidenceReasoning: reasoning || 'Unable to assess confidence',
      latencyMs: latency,
    });
  } catch (error) {
    console.error('Assess confidence error:', error);
    return NextResponse.json(
      { error: 'Failed to assess confidence' },
      { status: 500 }
    );
  }
}
