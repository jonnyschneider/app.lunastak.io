import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';

export const runtime = 'edge';
export const maxDuration = 300;

const FOLLOW_UP_PROMPT = `You are a strategic consultant. Based on the conversation so far, ask the next natural follow-up question to understand their business better.

Focus on understanding:
- Question 2: Who they're serving (target market)
- Question 3: What makes their approach unique (differentiation)

Keep it conversational - reference something specific from their previous answer. Just ask the question, nothing else.

Conversation so far:
{conversation}

Ask the next question:`;

export async function POST(req: Request) {
  try {
    const { conversationId, userResponse } = await req.json();

    if (!conversationId || !userResponse) {
      return NextResponse.json(
        { error: 'conversationId and userResponse are required' },
        { status: 400 }
      );
    }

    // Get conversation and messages
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

    const currentStep = conversation.messages.length + 1;

    // Save user's response
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userResponse,
        stepNumber: currentStep,
      },
    });

    // If we have 3 questions answered, don't ask another
    const userMessages = conversation.messages.filter(m => m.role === 'user').length + 1;
    if (userMessages >= 3) {
      return NextResponse.json({
        conversationId,
        complete: true,
        stepNumber: currentStep,
      });
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');
    const fullHistory = `${conversationHistory}\n\nUser: ${userResponse}`;

    // Generate next question
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: FOLLOW_UP_PROMPT.replace('{conversation}', fullHistory)
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;

    const nextQuestion = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'What else would you like to share about your business?';

    // Save next question
    await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: nextQuestion,
        stepNumber: currentStep + 1,
      },
    });

    return NextResponse.json({
      conversationId,
      message: nextQuestion,
      stepNumber: currentStep + 1,
      complete: false,
    });
  } catch (error) {
    console.error('Continue conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to continue conversation' },
      { status: 500 }
    );
  }
}
