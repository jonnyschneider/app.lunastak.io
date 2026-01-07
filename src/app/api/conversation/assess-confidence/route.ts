import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
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

const EMERGENT_CONFIDENCE_ASSESSMENT_PROMPT = `Evaluate this business strategy conversation for readiness to generate quality strategy output.

Conversation:
{conversation}

Assessment Criteria:

1. STRATEGIC UNDERSTANDING - Do you have enough context to generate meaningful Vision/Mission/Objectives?
   - Enough concrete detail about the business
   - Clear understanding of what matters to them
   - Sufficient context about their situation

2. SPECIFICITY - Are responses concrete enough to work with?
   - Specific enough to generate resonant strategy statements
   - Clear enough to identify strengths and opportunities
   - Sufficient for generating strategy that feels authentic to their business

Remember: We're not checking if prescribed fields are filled. We're assessing if we understand their business well enough to generate strategy that will resonate.

Return your assessment:
<assessment>
  <confidence>HIGH or MEDIUM or LOW</confidence>
  <reasoning>Brief explanation (1-2 sentences) about strategic understanding</reasoning>
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

    // Determine assessment approach based on experiment variant
    const isEmergent = conversation.experimentVariant === 'emergent-extraction-e1a';
    const assessmentPrompt = isEmergent
      ? EMERGENT_CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory)
      : CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory);

    // Assess confidence
    const startTime = Date.now();
    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: assessmentPrompt
      }],
      temperature: 0.3
    }, 'confidence_assessment');
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
