import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { getExperimentVariant } from '@/lib/statsig';

export const maxDuration = 60;

const FIRST_QUESTION_PROMPT = `You are a strategic consultant helping someone articulate their business strategy.

Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended.

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct question.`;

export async function POST(req: Request) {
  try {
    const { userId: guestUserId, variantOverride } = await req.json();

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);

    // Use authenticated user ID if logged in, otherwise use guest ID for tracking
    const userId = session?.user?.id || guestUserId || `guest_${Date.now()}`;

    // For statsig, use the same userId
    const statsigUserId = userId;

    // Determine experiment variant (with optional override)
    const experimentVariant = await getExperimentVariant(statsigUserId, variantOverride);

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId, // Guest ID (e.g. "guest_1234567890") for guests, real User.id for authenticated users
        status: 'in_progress',
        experimentVariant,
      },
    });

    // Generate first question
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: FIRST_QUESTION_PROMPT
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;

    const firstQuestion = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'What business challenge or opportunity are you working on right now?';

    // Save first message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: firstQuestion,
        stepNumber: 1,
      },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: firstQuestion,
      stepNumber: 1,
      experimentVariant: conversation.experimentVariant,
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}
