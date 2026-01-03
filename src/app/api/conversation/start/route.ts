import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { getExperimentVariant } from '@/lib/statsig';
import { getOrCreateDefaultProject } from '@/lib/projects';

export const maxDuration = 60;

const FIRST_QUESTION_PROMPT = `You are a strategic consultant helping someone articulate their business strategy.

Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended.

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct question.`;

export async function POST(req: Request) {
  try {
    const { userId: tempUserId, variantOverride } = await req.json();

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);

    // Only use userId if user is authenticated (User exists in DB)
    // For guests, userId will be null initially
    const authenticatedUserId = session?.user?.id || null;

    // For statsig, use actual userId or temp ID for guests (statsig needs an ID for variant assignment)
    const statsigUserId = authenticatedUserId || tempUserId || `guest_${Date.now()}`;

    // Determine experiment variant (with optional override)
    const experimentVariant = await getExperimentVariant(statsigUserId, variantOverride);

    // Get or create project (creates guest user + project for unauthenticated users)
    const { userId, project, isGuest } = await getOrCreateDefaultProject(authenticatedUserId);

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId, // guest user ID or authenticated user ID
        projectId: project.id,
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
      // Include guestUserId for session transfer when guest authenticates
      ...(isGuest && { guestUserId: userId }),
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 }
    );
  }
}
