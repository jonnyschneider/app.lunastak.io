import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { getExperimentVariant } from '@/lib/statsig';
import { getOrCreateDefaultProject } from '@/lib/projects';
import { getProjectKnowledgeForPrompt } from '@/lib/knowledge-summary';

export const maxDuration = 60;

const FIRST_QUESTION_PROMPT_NEW_USER = `You are Luna, a strategic consultant helping someone articulate their business strategy.

Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended.

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct question.`;

const FIRST_QUESTION_PROMPT_RETURNING_USER = `You are Luna, a strategic consultant helping someone articulate their business strategy.

{projectKnowledge}

---

This user has worked with you before. Given what you already know about their project, ask a warm, personalized opening question that:
1. Acknowledges you remember them and their work
2. Offers to continue exploring an area they haven't covered yet OR dive deeper into something they've mentioned
3. Keeps it conversational and open-ended

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct, personalized question.`;

const FIRST_QUESTION_PROMPT_DEEP_DIVE = `You are Luna, a strategic consultant helping someone articulate their business strategy.

{projectKnowledge}

---

This conversation is part of a deep dive exploration on: "{deepDiveTopic}"

Ask a focused opening question that:
1. Acknowledges this is a focused exploration on the specific topic
2. Invites them to share what they're currently thinking or what questions they have about this topic
3. Keeps it conversational and open-ended

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct question focused on the deep dive topic.`;

export async function POST(req: Request) {
  try {
    const { variantOverride, suggestedQuestion, deepDiveId } = await req.json();

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);

    // Only use userId if user is authenticated (User exists in DB)
    // For guests, userId will be null initially
    const authenticatedUserId = session?.user?.id || null;

    // Get or create project FIRST (creates guest user + project for unauthenticated users)
    // This ensures we have a consistent database user ID for Statsig
    const { userId, project, isGuest } = await getOrCreateDefaultProject(authenticatedUserId);

    // Use database userId for Statsig (ensures consistency with event logging)
    const experimentVariant = await getExperimentVariant(userId, variantOverride);

    // Look up deep dive if provided
    let deepDive = null;
    if (deepDiveId) {
      deepDive = await prisma.deepDive.findFirst({
        where: {
          id: deepDiveId,
          projectId: project.id,
        },
      });
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId, // guest user ID or authenticated user ID
        projectId: project.id,
        deepDiveId: deepDive?.id || null,
        status: 'in_progress',
        experimentVariant,
      },
    });

    let firstQuestion: string;

    // If a suggested question was provided, use it directly
    if (suggestedQuestion && typeof suggestedQuestion === 'string') {
      console.log('[Start] Using suggested question');
      firstQuestion = suggestedQuestion;
    } else {
      // Check if user has existing project knowledge (Luna Remembers)
      const projectKnowledge = await getProjectKnowledgeForPrompt(project.id);
      const hasProjectKnowledge = projectKnowledge && projectKnowledge.length > 100;

      // Select the appropriate prompt based on context
      let prompt: string;
      let promptType: string;

      if (deepDive) {
        // Deep dive focused conversation
        prompt = FIRST_QUESTION_PROMPT_DEEP_DIVE
          .replace('{projectKnowledge}', projectKnowledge || '')
          .replace('{deepDiveTopic}', deepDive.topic);
        promptType = 'deep_dive';
      } else if (hasProjectKnowledge) {
        // Returning user with knowledge
        prompt = FIRST_QUESTION_PROMPT_RETURNING_USER.replace('{projectKnowledge}', projectKnowledge);
        promptType = 'returning_user';
      } else {
        // New user
        prompt = FIRST_QUESTION_PROMPT_NEW_USER;
        promptType = 'new_user';
      }

      console.log('[Start] Using prompt type:', promptType);

      // Generate first question
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      });

      firstQuestion = response.content[0]?.type === 'text'
        ? response.content[0].text
        : 'What business challenge or opportunity are you working on right now?';
    }

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
