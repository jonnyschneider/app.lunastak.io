import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { GenerationViewedResponseContract } from '@/lib/contracts/generation-status';

/**
 * Mark a generation as viewed.
 * Called when user visits the strategy page.
 * Sets viewedAt timestamp if not already set.
 */
export async function POST(
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
      viewedAt: true,
    }
  });

  if (!generatedOutput) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    );
  }

  // Only update if not already viewed
  const viewedAt = generatedOutput.viewedAt || new Date();

  if (!generatedOutput.viewedAt) {
    await prisma.generatedOutput.update({
      where: { id },
      data: { viewedAt }
    });
  }

  const response: GenerationViewedResponseContract = {
    success: true,
    viewedAt: viewedAt.toISOString(),
  };

  return NextResponse.json(response);
}
