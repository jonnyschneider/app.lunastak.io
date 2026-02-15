import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { GenerationStatusResponseContract } from '@/lib/contracts/generation-status';

// Polling endpoint — must never be cached
export const dynamic = 'force-dynamic';

/**
 * Polling endpoint for generation status.
 * Client polls every 2-3 seconds until status is 'complete' or 'failed'.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Generation ID is required' },
      { status: 400 }
    );
  }

  const generatedOutput = await prisma.generatedOutput.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startedAt: true,
      error: true,
      createdAt: true,
    }
  });

  if (!generatedOutput) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    );
  }

  // Get traceId if complete (need to find associated trace)
  let traceId: string | undefined;
  if (generatedOutput.status === 'complete') {
    // Path 1: Initial generation — linked via extractionRun -> conversationId -> trace
    const extractionRun = await prisma.extractionRun.findFirst({
      where: { generatedOutputId: id },
      select: { conversationId: true }
    });

    if (extractionRun?.conversationId) {
      const trace = await prisma.trace.findFirst({
        where: { conversationId: extractionRun.conversationId },
        orderBy: { timestamp: 'desc' },
        select: { id: true }
      });
      traceId = trace?.id;
    }

    // Path 2: Refresh generation — no extractionRun, find trace by projectId + timing
    if (!traceId) {
      const output = await prisma.generatedOutput.findUnique({
        where: { id },
        select: { projectId: true, generatedFrom: true, startedAt: true }
      });

      if (output?.generatedFrom === 'incremental_refresh' && output.startedAt) {
        const trace = await prisma.trace.findFirst({
          where: {
            projectId: output.projectId,
            timestamp: { gte: output.startedAt },
          },
          orderBy: { timestamp: 'desc' },
          select: { id: true }
        });
        traceId = trace?.id;
      }
    }
  }

  const response: GenerationStatusResponseContract = {
    status: generatedOutput.status as 'pending' | 'generating' | 'complete' | 'failed',
    startedAt: generatedOutput.startedAt?.toISOString(),
    ...(generatedOutput.status === 'complete' && traceId && { traceId }),
    ...(generatedOutput.status === 'complete' && { completedAt: new Date().toISOString() }),
    ...(generatedOutput.status === 'failed' && generatedOutput.error && { error: generatedOutput.error }),
  };

  return NextResponse.json(response);
}
