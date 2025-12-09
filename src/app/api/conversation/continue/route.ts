import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import { ConversationPhase, StrategyLens, ConfidenceLevel } from '@/lib/types';
import {
  LENS_SELECTION_TEXT,
  getLensFramingPrompt,
  getAcknowledgmentPrompt
} from '@/lib/lens-prompts';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { conversationId, userResponse, currentPhase } = await req.json();

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

    // Route based on phase
    const phase = currentPhase as ConversationPhase;

    if (phase === 'INITIAL') {
      return await handleInitialPhase(conversation.id, userResponse, currentStep);
    } else if (phase === 'LENS_SELECTION') {
      return await handleLensSelection(conversation.id, userResponse, currentStep);
    } else if (phase === 'QUESTIONING') {
      return await handleQuestioning(conversation.id, currentStep);
    }

    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });

  } catch (error) {
    console.error('Continue conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to continue conversation' },
      { status: 500 }
    );
  }
}

async function handleInitialPhase(
  conversationId: string,
  userResponse: string,
  currentStep: number
) {
  // Generate acknowledgment
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: getAcknowledgmentPrompt(userResponse)
    }],
    temperature: 0.7
  });

  const acknowledgment = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Thanks for sharing that.';

  // Combine acknowledgment with lens selection
  const fullMessage = `${acknowledgment}\n\n${LENS_SELECTION_TEXT}`;

  // Save assistant's message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: fullMessage,
      stepNumber: currentStep + 1,
    },
  });

  // Update conversation phase
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { currentPhase: 'LENS_SELECTION' },
  });

  return NextResponse.json({
    conversationId,
    message: fullMessage,
    nextPhase: 'LENS_SELECTION',
    stepNumber: currentStep + 1,
  });
}

async function handleLensSelection(
  conversationId: string,
  userResponse: string,
  currentStep: number
) {
  // Validate lens choice
  const lens = userResponse.trim().toUpperCase();
  if (!['A', 'B', 'C', 'D', 'E'].includes(lens)) {
    const errorMessage = 'Please type A, B, C, D, or E to select your lens.';

    await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: errorMessage,
        stepNumber: currentStep + 1,
      },
    });

    return NextResponse.json({
      conversationId,
      message: errorMessage,
      nextPhase: 'LENS_SELECTION',
      stepNumber: currentStep + 1,
      error: 'Invalid lens choice',
    });
  }

  // Get conversation history for context
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

  // Generate first lens-framed question
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: getLensFramingPrompt(lens as StrategyLens, conversationHistory)
    }],
    temperature: 0.7
  });

  const firstQuestion = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'Tell me more about your business.';

  // Save question
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: firstQuestion,
      stepNumber: currentStep + 1,
    },
  });

  // Update conversation with lens and phase
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      selectedLens: lens,
      currentPhase: 'QUESTIONING',
      questionCount: 1,
    },
  });

  return NextResponse.json({
    conversationId,
    message: firstQuestion,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
    selectedLens: lens,
  });
}

async function handleQuestioning(
  conversationId: string,
  currentStep: number
) {
  // Get conversation with full context
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if previous assistant message was an early exit offer
  const lastAssistantMessage = conversation.messages
    .filter((m: { role: string }) => m.role === 'assistant')
    .pop();

  const previousUserMessage = conversation.messages
    .filter((m: { role: string }) => m.role === 'user')
    .pop();

  const isEarlyExitOffer = lastAssistantMessage?.content.includes('A) Continue exploring') &&
                           lastAssistantMessage?.content.includes('B) Generate strategy');

  if (isEarlyExitOffer && previousUserMessage) {
    // Process early exit response
    const userChoice = previousUserMessage.content.trim().toUpperCase();

    if (userChoice === 'B') {
      // User chose to generate strategy
      return await moveToExtraction(conversationId, currentStep);
    } else if (userChoice === 'A') {
      // User chose to continue exploring - proceed with normal questioning flow
      const questionCount = conversation.questionCount;
      const selectedLens = conversation.selectedLens as StrategyLens;
      return await continueQuestioning(conversationId, selectedLens, questionCount, currentStep);
    } else {
      // Invalid choice - re-prompt
      const errorMessage = 'Please type A to continue exploring or B to generate your strategy.';

      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: errorMessage,
          stepNumber: currentStep + 1,
        },
      });

      return NextResponse.json({
        conversationId,
        message: errorMessage,
        nextPhase: 'QUESTIONING',
        stepNumber: currentStep + 1,
        earlyExitOffered: true,
      });
    }
  }

  const questionCount = conversation.questionCount;
  const selectedLens = conversation.selectedLens as StrategyLens;

  // Call confidence assessment
  const confidenceResponse = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/conversation/assess-confidence`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }
  );

  const { confidenceScore, confidenceReasoning } = await confidenceResponse.json();

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
  if (questionCount < 3) {
    // Must ask minimum 3 questions
    return await continueQuestioning(conversationId, selectedLens, questionCount, currentStep);
  } else if (questionCount >= 10) {
    // Max reached
    return await moveToExtraction(conversationId, currentStep);
  } else if (confidenceScore === 'HIGH') {
    // Offer early exit
    return await offerEarlyExit(conversationId, currentStep);
  } else {
    // Need more coverage/specificity
    return await continueQuestioning(conversationId, selectedLens, questionCount, currentStep);
  }
}

async function continueQuestioning(
  conversationId: string,
  selectedLens: StrategyLens,
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

  // Generate next question
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: getLensFramingPrompt(selectedLens, conversationHistory)
    }],
    temperature: 0.7
  });

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
  const exitMessage = `I think I have what I need to create your strategy.

Would you like to:
A) Continue exploring
B) Generate strategy

Type A or B:`;

  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: exitMessage,
      stepNumber: currentStep + 1,
    },
  });

  // Stay in QUESTIONING phase but flag early exit offered
  return NextResponse.json({
    conversationId,
    message: exitMessage,
    nextPhase: 'QUESTIONING',
    stepNumber: currentStep + 1,
    earlyExitOffered: true,
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
