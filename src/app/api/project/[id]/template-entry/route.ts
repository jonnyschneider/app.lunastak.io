import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess, isDenied } from '@/lib/auth/guard';
import { planPipeline, executePipeline } from '@/lib/pipeline';
import type { StrategyStatements } from '@/lib/types';

/**
 * POST /api/project/[id]/template-entry
 * Creates a Decision Stack from user-provided template data
 * (inverse of conversation-first flow)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const auth = await requireProjectAccess(projectId);
  if (isDenied(auth)) return auth;
  const { userId } = auth.requester;

  const body = await request.json();
  const { statements } = body as { statements: StrategyStatements };

  if (!statements || !statements.vision) {
    return NextResponse.json({ error: 'Vision is required' }, { status: 400 });
  }

  try {
    const trigger = {
      type: 'template_submitted' as const,
      projectId,
      userId,
      statements,
    };
    const plan = planPipeline(trigger);
    const result = await executePipeline(plan, trigger);

    return NextResponse.json({ traceId: result.generation?.traceId });
  } catch (error) {
    console.error('[Template Entry] Error:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
