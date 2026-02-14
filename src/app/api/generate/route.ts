import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ExtractedContextVariant } from '@/lib/types';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';
import { waitUntil } from '@vercel/functions';
import { planPipeline, executePipeline } from '@/lib/pipeline';
import type { GenerationStartedContract } from '@/lib/contracts/generation-status';

export const maxDuration = 300; // 5 minutes for Pro plan

/**
 * Fire-and-forget generation API.
 *
 * Creates a GeneratedOutput record immediately, starts generation in background,
 * and returns the generationId for polling.
 */
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started (fire-and-forget mode)');

  // Parse request body
  let conversationId: string;
  let extractedContext: ExtractedContextVariant;
  let dimensionalCoverage: any;

  try {
    const body = await req.json();
    conversationId = body.conversationId;
    extractedContext = body.extractedContext;
    dimensionalCoverage = body.dimensionalCoverage;
    console.log('[Generate API] Parsed request body, conversationId:', conversationId);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!conversationId || !extractedContext) {
    console.error('[Generate API] Missing required fields');
    return NextResponse.json(
      { error: 'conversationId and extractedContext are required' },
      { status: 400 }
    );
  }

  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    console.error('[Generate API] Conversation not found:', conversationId);
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  // Check guest API limit
  if (conversation.userId) {
    const { blocked } = await checkAndIncrementGuestApiCalls(conversation.userId);
    if (blocked) {
      console.log('[Generate API] Guest API limit reached');
      return NextResponse.json(
        { error: 'limit_reached', message: 'Demo limit reached. Sign up to continue.' },
        { status: 429 }
      );
    }
  }

  // Require projectId for fire-and-forget (need somewhere to store the output)
  if (!conversation.projectId) {
    console.error('[Generate API] No projectId for conversation:', conversationId);
    return NextResponse.json(
      { error: 'Conversation must have a projectId for generation' },
      { status: 400 }
    );
  }

  // Create GeneratedOutput record upfront with 'generating' status
  const generatedOutput = await prisma.generatedOutput.create({
    data: {
      projectId: conversation.projectId,
      userId: conversation.userId,
      outputType: 'full_decision_stack',
      version: 1,
      status: 'generating',
      startedAt: new Date(),
      content: {}, // Empty initially, populated on completion
    }
  });

  console.log('[Generate API] Created GeneratedOutput with ID:', generatedOutput.id, 'status: generating');

  // Start background generation via pipeline orchestrator
  waitUntil((async () => {
    try {
      const trigger = {
        type: 'conversation_ended' as const,
        projectId: conversation.projectId!,
        conversationId,
        userId: conversation.userId,
        isInitial: true,
        experimentVariant: conversation.experimentVariant,
        extractionResult: {
          extractedContext,
          dimensionalCoverage,
        },
        generatedOutputId: generatedOutput.id,
      };
      const plan = planPipeline(trigger);
      await executePipeline(plan, trigger);
    } catch (error) {
      console.error('[Generate API] Background generation failed:', error);
      await prisma.generatedOutput.update({
        where: { id: generatedOutput.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Generation failed',
        },
      });
    }
  })());

  const setupTime = Date.now() - requestStartTime;
  console.log(`[Generate API] Returning immediately after ${setupTime}ms`);

  // Return immediately with generationId for polling
  const response: GenerationStartedContract = {
    status: 'started',
    generationId: generatedOutput.id,
  };

  return NextResponse.json(response);
}
