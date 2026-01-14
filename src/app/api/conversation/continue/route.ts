import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { extractXML } from '@/lib/utils';
import { ConversationPhase } from '@/lib/types';
import { getProjectKnowledgeForPrompt } from '@/lib/knowledge-summary';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';

export const maxDuration = 300; // 5 minutes for Pro plan

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Continue API] Request started');

  try {
    console.log('[Continue API] Parsing request body...');
    const { conversationId, userResponse, currentPhase } = await req.json();
    console.log('[Continue API] Parsed request body:', { conversationId, currentPhase, userResponseLength: userResponse?.length });

    if (!conversationId || !userResponse) {
      console.log('[Continue API] Missing required fields');
      return NextResponse.json(
        { error: 'conversationId and userResponse are required' },
        { status: 400 }
      );
    }

    // Get conversation and messages
    console.log('[Continue API] Fetching conversation from database...');
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
    console.log('[Continue API] Conversation found:', !!conversation, 'messages:', conversation?.messages.length);

    if (!conversation) {
      console.log('[Continue API] Conversation not found');
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check guest API limit
    if (conversation.userId) {
      const { blocked } = await checkAndIncrementGuestApiCalls(conversation.userId);
      if (blocked) {
        console.log('[Continue API] Guest API limit reached');
        return NextResponse.json(
          { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
          { status: 429 }
        );
      }
    }

    const currentStep = conversation.messages.length + 1;
    console.log('[Continue API] Current step:', currentStep);

    // Save user's response
    console.log('[Continue API] Saving user message to database...');
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userResponse,
        stepNumber: currentStep,
      },
    });
    console.log('[Continue API] User message saved');

    // Route based on phase
    const phase = currentPhase as ConversationPhase;
    console.log('[Continue API] Routing to phase handler:', phase);

    if (phase === 'INITIAL') {
      console.log('[Continue API] Handling INITIAL phase');
      return await handleInitialPhase(conversation.id, userResponse, currentStep);
    } else if (phase === 'QUESTIONING') {
      console.log('[Continue API] Handling QUESTIONING phase');
      return await handleQuestioning(conversation.id, currentStep);
    } else if (phase === 'EXTRACTION') {
      // Recovery: If we're in EXTRACTION phase but user is trying to continue,
      // it means extraction failed/timed out. Reset to QUESTIONING and continue.
      console.log('[Continue API] Handling EXTRACTION phase recovery - resetting to QUESTIONING');

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { currentPhase: 'QUESTIONING' },
      });

      // Generate a recovery message
      const recoveryMessage = "It looks like we had a hiccup. Let's continue our conversation - I still have everything we've discussed. What else would you like to explore?";

      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: recoveryMessage,
          stepNumber: currentStep + 1,
        },
      });

      return NextResponse.json({
        conversationId,
        message: recoveryMessage,
        nextPhase: 'QUESTIONING',
        stepNumber: currentStep + 1,
        recovered: true,
      });
    }

    console.log('[Continue API] Invalid phase:', phase);
    return NextResponse.json({ error: `Invalid phase: ${phase}` }, { status: 400 });

  } catch (error) {
    console.error('[Continue API] Error caught:', error);
    console.error('[Continue API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error(`[Continue API] Request failed after ${Date.now() - requestStartTime}ms`);
    return NextResponse.json(
      { error: 'Failed to continue conversation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleInitialPhase(
  conversationId: string,
  userResponse: string,
  currentStep: number
) {
  console.log('[Continue API - INITIAL] Starting initial phase handler');

  // Get conversation history for context
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const experimentVariant = conversation!.experimentVariant;
  console.log(`[Continue API - INITIAL] Using ${experimentVariant} questioning approach`);

  // Select prompt based on experiment variant
  const EMERGENT_INITIAL_PROMPT = `You are a strategic advisor helping develop a strategic framework for a SaaS/digital business.

The user just responded to your opening question with:
"${userResponse}"

Based on their response, ask a natural follow-up question that will help you extract information for:
- Core context (industry, target market, unique value)
- Enrichment areas (competitive context, customer segments, operational capabilities, technical advantages)

Keep the question warm, conversational, and specific to what they shared. Build naturally on their response.

Return only the question, no preamble.`;

  const DIMENSION_GUIDED_INITIAL_PROMPT = `You are a strategic advisor helping develop a strategic framework for a SaaS/digital business.

The user just responded to your opening question with:
"${userResponse}"

Strategic dimensions to consider (for your awareness only - never mention these explicitly):
1. Customer & Market - who we serve, their problems, buying behaviour
2. Problem & Opportunity - the problem space, opportunity size, why now
3. Value Proposition - what we offer, how it solves problems
4. Differentiation & Advantage - what makes us unique, defensibility
5. Competitive Landscape - who else plays, positioning
6. Business Model & Economics - how we create/capture value, unit economics
7. Go-to-Market - sales strategy, customer success, channels
8. Product Experience - the experience we're creating, customer journey
9. Capabilities & Assets - what we can do, team, technology
10. Risks & Constraints - risks, dependencies, limitations
11. Strategic Intent - aspirations, goals, direction

Based on their response, identify which dimensions they've touched on and which remain unexplored.
Ask a warm, conversational follow-up question that naturally explores an important dimension
while building on what they shared.

Return only the question, no preamble.`;

  const prompt = experimentVariant === 'dimension-guided-e3'
    ? DIMENSION_GUIDED_INITIAL_PROMPT
    : EMERGENT_INITIAL_PROMPT;

  const startTime = Date.now();
  console.log('[Continue API - INITIAL] Calling Claude API for first question...');
  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.7
  }, 'continue_initial');

  const firstQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Tell me more about your business.';
  console.log(`[Continue API - INITIAL] Claude responded in ${Date.now() - startTime}ms`);

  // Save question
  console.log('[Continue API - INITIAL] Saving first question...');
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: firstQuestion,
      stepNumber: currentStep + 1,
    },
  });

  // Update conversation phase directly to QUESTIONING
  console.log('[Continue API - INITIAL] Updating conversation phase...');
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      currentPhase: 'QUESTIONING',
      questionCount: 1,
    },
  });

  console.log('[Continue API - INITIAL] Phase handler complete');
  return NextResponse.json({
    conversationId,
    message: firstQuestion,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
  });
}


async function handleQuestioning(
  conversationId: string,
  currentStep: number
) {
  console.log('[Continue API - QUESTIONING] Starting questioning phase handler');
  // Get conversation with full context
  console.log('[Continue API - QUESTIONING] Fetching conversation...');
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  if (!conversation) {
    console.log('[Continue API - QUESTIONING] Conversation not found');
    throw new Error('Conversation not found');
  }
  console.log('[Continue API - QUESTIONING] Conversation found, questionCount:', conversation.questionCount);

  // Check if previous assistant message was an early exit offer
  // With the new UX, if user replies after early exit offer, they want to continue
  const lastAssistantMessage = conversation.messages
    .filter((m: { role: string }) => m.role === 'assistant')
    .pop();

  const isEarlyExitOffer = lastAssistantMessage?.content === 'I have what I need to create your strategy.';

  if (isEarlyExitOffer) {
    // User chose to continue by replying - proceed with normal questioning
    console.log('[Continue API - QUESTIONING] User continued after early exit offer');
  }

  const questionCount = conversation.questionCount;
  console.log('[Continue API - QUESTIONING] QuestionCount:', questionCount);

  // Call confidence assessment (inline to avoid serverless fetch issues)
  console.log('[Continue API - QUESTIONING] Calling confidence assessment...');

  const conversationHistory = conversation.messages
    .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  const CONFIDENCE_PROMPT = `Evaluate this business strategy conversation for readiness to generate quality strategy output.

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

  const confidenceResponse = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: CONFIDENCE_PROMPT.replace('{conversation}', conversationHistory)
    }],
    temperature: 0.3
  }, 'continue_confidence');

  const confidenceContent = confidenceResponse.content[0]?.type === 'text' ? confidenceResponse.content[0].text : '';

  const assessmentXML = extractXML(confidenceContent, 'assessment');
  const confidenceScore = extractXML(assessmentXML, 'confidence') || 'MEDIUM';
  const confidenceReasoning = extractXML(assessmentXML, 'reasoning') || 'Unable to assess confidence';

  console.log('[Continue API - QUESTIONING] Confidence assessment complete:', confidenceScore);

  // Update last user message with confidence
  const lastUserMessage = conversation.messages
    .filter((m: { role: string }) => m.role === 'user')
    .pop();

  if (lastUserMessage) {
    await prisma.message.update({
      where: { id: lastUserMessage.id },
      data: {
        confidenceScore,
        confidenceReasoning,
      },
    });
  }

  // Decision logic
  console.log('[Continue API - QUESTIONING] Evaluating decision logic...');
  if (questionCount < 3) {
    // Must ask minimum 3 questions
    console.log('[Continue API - QUESTIONING] Decision: Continue questioning (min 3 questions)');
    return await continueQuestioning(conversationId, questionCount, currentStep);
  } else if (questionCount >= 10) {
    // Max reached
    console.log('[Continue API - QUESTIONING] Decision: Move to extraction (max 10 questions)');
    return await moveToExtraction(conversationId, currentStep);
  } else if (confidenceScore === 'HIGH') {
    // Offer early exit
    console.log('[Continue API - QUESTIONING] Decision: Offer early exit (high confidence)');
    return await offerEarlyExit(conversationId, currentStep);
  } else {
    // Need more coverage/specificity
    console.log('[Continue API - QUESTIONING] Decision: Continue questioning (need more depth)');
    return await continueQuestioning(conversationId, questionCount, currentStep);
  }
}

// Prompt for E2: Emergent questioning (follow the user's thread)
const EMERGENT_QUESTION_PROMPT = (conversationHistory: string, projectKnowledge?: string | null) => {
  const knowledgeSection = projectKnowledge
    ? `\n## What You Already Know (from previous conversations)\n${projectKnowledge}\n`
    : '';

  return `You are Luna, a strategic advisor helping develop a strategic framework for a SaaS/digital business.
${knowledgeSection}
## Current Conversation
${conversationHistory}

Based on the conversation, ask the next natural follow-up question that will help you extract information for:
- Core context (industry, target market, unique value)
- Enrichment areas (competitive context, customer segments, operational capabilities, technical advantages)

Keep the question warm, conversational, and build naturally on what's been discussed. Focus on areas not yet explored.
${projectKnowledge ? 'Consider both this conversation AND what you already know from previous sessions.' : ''}

Return only the question, no preamble.`;
};

// Prompt for E3: Dimension-guided questioning (steer toward gaps)
const DIMENSION_GUIDED_PROMPT = (conversationHistory: string, projectKnowledge?: string | null) => {
  const knowledgeSection = projectKnowledge
    ? `\n## What You Already Know (from previous conversations)\n${projectKnowledge}\n`
    : '';

  return `You are Luna, a strategic advisor helping develop a strategic framework for a SaaS/digital business.
${knowledgeSection}
## Current Conversation
${conversationHistory}

Strategic dimensions to consider (for your awareness only - never mention these explicitly):
1. Customer & Market - who we serve, their problems, buying behaviour
2. Problem & Opportunity - the problem space, opportunity size, why now
3. Value Proposition - what we offer, how it solves problems
4. Differentiation & Advantage - what makes us unique, defensibility
5. Competitive Landscape - who else plays, positioning
6. Business Model & Economics - how we create/capture value, unit economics
7. Go-to-Market - sales strategy, customer success, channels
8. Product Experience - the experience we're creating, customer journey
9. Capabilities & Assets - what we can do, team, technology
10. Risks & Constraints - risks, dependencies, limitations
11. Strategic Intent - aspirations, goals, direction

Review the conversation${projectKnowledge ? ' and your prior knowledge' : ''} to identify which dimensions have been well-covered and which are thin or missing.

Ask a warm, conversational follow-up question that naturally explores an under-covered dimension.
The question should feel like a natural continuation of the conversation, not a checklist item.

Return only the question, no preamble.`;
};

async function continueQuestioning(
  conversationId: string,
  questionCount: number,
  currentStep: number
) {
  // Get conversation history
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const conversationHistory = conversation!.messages
    .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  // Get project knowledge for context (Luna Remembers)
  const projectKnowledge = conversation!.projectId
    ? await getProjectKnowledgeForPrompt(conversation!.projectId)
    : null;

  // Select prompt based on experiment variant
  const experimentVariant = conversation!.experimentVariant;
  const prompt = experimentVariant === 'dimension-guided-e3'
    ? DIMENSION_GUIDED_PROMPT(conversationHistory, projectKnowledge)
    : EMERGENT_QUESTION_PROMPT(conversationHistory, projectKnowledge);

  console.log(`[Continue API] Using ${experimentVariant} questioning approach, has project knowledge: ${!!projectKnowledge}`);

  const startTime = Date.now();
  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.7
  }, 'continue_questioning');

  const nextQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Tell me more.';

  // Save question
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: nextQuestion,
      stepNumber: currentStep + 1,
    },
  });

  // Increment question count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { questionCount: questionCount + 1 },
  });

  return NextResponse.json({
    conversationId,
    message: nextQuestion,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
  });
}

async function offerEarlyExit(
  conversationId: string,
  currentStep: number
) {
  // Generate a follow-up question
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { stepNumber: 'asc' } } },
  });

  const conversationHistory = conversation!.messages
    .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  const experimentVariant = conversation!.experimentVariant;
  const prompt = experimentVariant === 'dimension-guided-e3'
    ? `Based on this conversation, suggest ONE follow-up question that would explore an under-covered strategic dimension. Return ONLY the question.\n\n${conversationHistory}`
    : `Based on this conversation, suggest ONE follow-up question to deepen understanding. Return ONLY the question.\n\n${conversationHistory}`;

  const response = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }, 'continue_early_exit');

  const suggestedQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'What else would you like to explore?';

  const exitMessage = `I have what I need to create your strategy.`;

  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: exitMessage,
      stepNumber: currentStep + 1,
    },
  });

  return NextResponse.json({
    conversationId,
    message: exitMessage,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
    earlyExitOffered: true,
    suggestedQuestion,
  });
}

async function moveToExtraction(
  conversationId: string,
  currentStep: number
) {
  const message = "We've covered a lot of ground. Let me show you what I've captured and we can refine from there.";

  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: message,
      stepNumber: currentStep + 1,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { currentPhase: 'EXTRACTION' },
  });

  return NextResponse.json({
    conversationId,
    message,
    nextPhase: 'EXTRACTION',
    stepNumber: currentStep + 1,
    complete: true,
  });
}
