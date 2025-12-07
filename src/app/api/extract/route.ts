import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ExtractedContext, ExtractionConfidence, Message } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 300;

const EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract structured information and assess confidence.

Conversation:
{conversation}

Extract the following and assess your confidence (HIGH/MEDIUM/LOW):

<context>
  <industry>The specific industry (be specific, not generic)</industry>
  <target_market>The specific customer segment they're targeting</target_market>
  <unique_value>Their key differentiator or unique value proposition</unique_value>
  <confidence>HIGH/MEDIUM/LOW</confidence>
</context>

If confidence is not HIGH, also include:
<missing>
What specific information is unclear or missing
</missing>`;

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
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Extract context
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
      }],
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const contextXML = extractXML(content, 'context');
    const industry = extractXML(contextXML, 'industry');
    const targetMarket = extractXML(contextXML, 'target_market');
    const uniqueValue = extractXML(contextXML, 'unique_value');
    const confidence = extractXML(contextXML, 'confidence') as ExtractionConfidence;
    const missing = extractXML(content, 'missing');

    const extractedContext: ExtractedContext = {
      industry,
      targetMarket,
      uniqueValue,
      extractionConfidence: confidence || 'MEDIUM',
      rawConversation: conversation.messages as Message[],
    };

    return NextResponse.json({
      extractedContext,
      missing: missing || null,
      needsClarification: confidence !== 'HIGH',
    });
  } catch (error) {
    console.error('Extract context error:', error);
    return NextResponse.json(
      { error: 'Failed to extract context' },
      { status: 500 }
    );
  }
}
