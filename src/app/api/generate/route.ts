import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAndIncrementGuestApiCalls } from '@/lib/projects';
import { waitUntil } from '@vercel/functions';
import { planPipeline, executePipeline } from '@/lib/pipeline';
import { setGenerationStatus } from '@/lib/decision-stack';
import type { GenerationStartedContract } from '@/lib/contracts/generation-status';

export const maxDuration = 300; // 5 minutes for Pro plan

/**
 * Fire-and-forget generation API.
 *
 * Sets DecisionStack generation status, starts generation in background,
 * and returns a generationId for client-side task tracking.
 */
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started (fire-and-forget mode)');

  // Parse request body
  let conversationId: string;

  try {
    const body = await req.json();
    conversationId = body.conversationId;
    console.log('[Generate API] Parsed request body, conversationId:', conversationId);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!conversationId) {
    console.error('[Generate API] Missing conversationId');
    return NextResponse.json(
      { error: 'conversationId is required' },
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

  // Require projectId
  if (!conversation.projectId) {
    console.error('[Generate API] No projectId for conversation:', conversationId);
    return NextResponse.json(
      { error: 'Conversation must have a projectId for generation' },
      { status: 400 }
    );
  }

  // Set generation status for polling
  await setGenerationStatus(conversation.projectId, 'generating');

  const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log('[Generate API] Starting generation', generationId);

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
      };
      const plan = planPipeline(trigger);
      await executePipeline(plan, trigger);
    } catch (error) {
      console.error('[Generate API] Background generation failed:', error);
      await setGenerationStatus(conversation.projectId!, null);
    }
  })());

  const setupTime = Date.now() - requestStartTime;
  console.log(`[Generate API] Returning immediately after ${setupTime}ms`);

  // Return immediately with generationId for polling
  const response: GenerationStartedContract = {
    status: 'started',
    generationId,
  };

  return NextResponse.json(response);
}
