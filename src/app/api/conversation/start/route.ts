import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { getExperimentVariant } from '@/lib/statsig';
import { getOrCreateDefaultProject } from '@/lib/projects';
import { getProjectKnowledgeForPrompt } from '@/lib/knowledge-summary';
import { DIMENSION_CONTEXT, Tier1Dimension } from '@/lib/constants/dimensions';

const GUEST_COOKIE_NAME = 'guestUserId';

export const maxDuration = 300; // 5 minutes for Pro plan

const FIRST_QUESTION_PROMPT_NEW_USER = `You are Luna, a strategic consultant helping someone articulate their business strategy.

Ask them to describe their business challenge or opportunity in their own words. Keep it warm, conversational, and open-ended.

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct question.`;

const FIRST_QUESTION_PROMPT_RETURNING_USER = `You are Luna, a strategic consultant helping someone articulate their business strategy.

{projectKnowledge}

---

This user has worked with you before. Ask a warm opening question that:
1. Briefly acknowledges you have context from your previous conversations (one short phrase)
2. Invites them to share what's on their mind - let THEM choose the focus
3. Keeps it conversational, open, and non-directive

Do NOT suggest specific topics or areas to explore. Let the user drive the conversation focus.

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

const FIRST_QUESTION_PROMPT_GAP_EXPLORATION = `You are Luna, a strategic consultant helping someone articulate their business strategy.

{projectKnowledge}

---

## Gap Exploration Context

The user wants to strengthen their thinking around **{dimensionName}**.

**What we're trying to understand in this dimension:**
{understandingQuestions}

**Where to focus (based on analysis of their current strategic coverage):**
{focusSummary}

**Related strategic frameworks (use as soft boundaries):**
{frameworks}

---

Ask a focused opening question that:
1. Warmly acknowledges you've noticed an opportunity to strengthen their thinking in this area
2. Uses the focus summary to guide where to start the conversation
3. Draws from the "what we're understanding" questions to shape your inquiry
4. Keeps it conversational, curious, and not overwhelming

The goal is to help them articulate their thinking in this dimension, not to quiz them.

IMPORTANT: Output ONLY the question itself. No preambles like "I'm happy to help" or "I'd be glad to". Just the direct, warm question.`;

interface GapExploration {
  dimension: string;
  summary?: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log('[Start API] Request started');

  try {
    const { variantOverride, suggestedQuestion, deepDiveId, gapExploration, projectId: requestedProjectId, origin } = await req.json() as {
      variantOverride?: string;
      suggestedQuestion?: string;
      deepDiveId?: string;
      gapExploration?: GapExploration;
      projectId?: string;
      origin?: { type: string; text: string };
    };
    console.log(`[Start API] Parsed body in ${Date.now() - startTime}ms, suggestedQuestion: ${!!suggestedQuestion}`);

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);
    console.log(`[Start API] Got session in ${Date.now() - startTime}ms`);

    // Check for existing guest cookie FIRST - before creating new users
    const cookieStore = await cookies();
    const existingGuestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

    // Determine user identity: authenticated > existing guest > new guest
    const authenticatedUserId = session?.user?.id || null;
    const existingUserId = authenticatedUserId || existingGuestId || null;

    // Get or create project - pass existing user ID if available
    // This ensures we use the existing guest's projects, not create a new user
    const { userId, project: defaultProject, isGuest } = await getOrCreateDefaultProject(existingUserId);
    console.log(`[Start API] Got project in ${Date.now() - startTime}ms`);

    // Use the requested project if provided and user has access, otherwise use default
    let targetProjectId = defaultProject.id;
    if (requestedProjectId) {
      // Verify user has access to the requested project
      const requestedProject = await prisma.project.findFirst({
        where: {
          id: requestedProjectId,
          userId: userId,
          status: 'active',
        },
        select: { id: true },
      });
      if (requestedProject) {
        targetProjectId = requestedProject.id;
      } else {
        console.warn('[Start] Requested project not found or not owned by user, using default. Requested:', requestedProjectId, 'User:', userId);
      }
    }

    // Use database userId for Statsig (ensures consistency with event logging)
    const experimentVariant = await getExperimentVariant(userId, variantOverride);
    console.log(`[Start API] Got experiment variant in ${Date.now() - startTime}ms`);

    // Look up deep dive if provided
    let deepDive = null;
    if (deepDiveId) {
      deepDive = await prisma.deepDive.findFirst({
        where: {
          id: deepDiveId,
          projectId: targetProjectId,
        },
      });
    }

    // Check if project has any existing strategy (completed trace with output)
    const hasExistingStrategy = await prisma.trace.findFirst({
      where: {
        conversation: { projectId: targetProjectId },
        output: { not: {} },  // Has generated output
      },
      select: { id: true },
    });

    // Derive initial title from origin context
    const initialTitle = deepDive?.topic
      || (origin?.text ? origin.text.slice(0, 80) : null)
      || (gapExploration?.summary ? gapExploration.summary.slice(0, 80) : null)
      || null  // Organic chats get titled after a few exchanges

    // Clean up abandoned single-message conversations for this project
    const abandoned = await prisma.conversation.findMany({
      where: {
        projectId: targetProjectId,
        userId,
        status: 'in_progress',
        messages: { none: { role: 'user' } },  // No user messages — only system prompt
      },
      select: { id: true },
    })
    if (abandoned.length > 0) {
      await prisma.message.deleteMany({ where: { conversationId: { in: abandoned.map(c => c.id) } } })
      await prisma.conversation.deleteMany({ where: { id: { in: abandoned.map(c => c.id) } } })
      console.log(`[Start API] Cleaned up ${abandoned.length} abandoned conversations`)
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId, // guest user ID or authenticated user ID
        projectId: targetProjectId,
        deepDiveId: deepDive?.id || null,
        title: initialTitle,
        status: 'in_progress',
        experimentVariant,
        isInitialConversation: !hasExistingStrategy,  // True if no strategy exists yet
        originType: origin?.type || (gapExploration ? 'gap' : deepDive ? 'deep_dive' : 'organic'),
        originText: origin?.text || gapExploration?.summary || null,
      },
    });
    console.log(`[Start API] Created conversation in ${Date.now() - startTime}ms`);

    let firstQuestion: string;

    // If a suggested question was provided, use it directly
    if (suggestedQuestion && typeof suggestedQuestion === 'string') {
      console.log(`[Start API] Using suggested question (skipping Claude call) at ${Date.now() - startTime}ms`);
      firstQuestion = suggestedQuestion;
    } else {
      // Check if user has existing project knowledge (Luna Remembers)
      const projectKnowledge = await getProjectKnowledgeForPrompt(targetProjectId);
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
      } else if (gapExploration) {
        // Gap exploration conversation - use taxonomy context
        const dimensionKey = gapExploration.dimension as Tier1Dimension;
        const context = DIMENSION_CONTEXT[dimensionKey];

        if (!context) {
          console.warn(`[Start] Unknown dimension: ${gapExploration.dimension}, falling back to returning user prompt`);
          prompt = hasProjectKnowledge
            ? FIRST_QUESTION_PROMPT_RETURNING_USER.replace('{projectKnowledge}', projectKnowledge || '')
            : FIRST_QUESTION_PROMPT_NEW_USER;
          promptType = 'gap_exploration_fallback';
        } else {
          const understandingQuestions = context.understanding.map(q => `- ${q}`).join('\n');
          const focusSummary = gapExploration.summary || 'No specific focus identified yet - explore broadly within this dimension.';

          prompt = FIRST_QUESTION_PROMPT_GAP_EXPLORATION
            .replace('{projectKnowledge}', projectKnowledge || '')
            .replace('{dimensionName}', context.name)
            .replace('{understandingQuestions}', understandingQuestions)
            .replace('{focusSummary}', focusSummary)
            .replace('{frameworks}', context.frameworks);
          promptType = 'gap_exploration';
        }
      } else if (hasProjectKnowledge) {
        // Returning user with knowledge
        prompt = FIRST_QUESTION_PROMPT_RETURNING_USER.replace('{projectKnowledge}', projectKnowledge);
        promptType = 'returning_user';
      } else {
        // New user
        prompt = FIRST_QUESTION_PROMPT_NEW_USER;
        promptType = 'new_user';
      }

      console.log(`[Start API] Using prompt type: ${promptType} at ${Date.now() - startTime}ms`);

      // Generate first question
      const claudeStart = Date.now();
      const response = await createMessage({
        model: CLAUDE_MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      }, 'conversation_start', userId);
      console.log(`[Start API] Claude responded in ${Date.now() - claudeStart}ms (total: ${Date.now() - startTime}ms)`);

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
    console.log(`[Start API] Request complete in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      conversationId: conversation.id,
      message: firstQuestion,
      stepNumber: 1,
      experimentVariant: conversation.experimentVariant,
      // Include deep dive info if conversation is linked to one
      ...(deepDive && { deepDive: { id: deepDive.id, topic: deepDive.topic } }),
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
