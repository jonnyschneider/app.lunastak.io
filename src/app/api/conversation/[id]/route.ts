import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
      deepDive: {
        select: { id: true, topic: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: conversation.id,
    status: conversation.status,
    currentPhase: conversation.currentPhase,
    experimentVariant: conversation.experimentVariant,
    messages: conversation.messages,
    deepDiveId: conversation.deepDiveId,
    deepDive: conversation.deepDive,
    isInitialConversation: conversation.isInitialConversation,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { deepDiveId, status } = await req.json();

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  // Build update data - only include fields that were provided
  const updateData: { deepDiveId?: string | null; status?: string } = {};
  if (deepDiveId !== undefined) {
    updateData.deepDiveId = deepDiveId || null;
  }
  if (status !== undefined) {
    // Validate status value
    const validStatuses = ['in_progress', 'completed', 'abandoned'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }
    updateData.status = status;
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: updateData,
    include: {
      deepDive: {
        select: { id: true, topic: true },
      },
    },
  });

  return NextResponse.json({
    deepDiveId: updated.deepDiveId,
    deepDive: updated.deepDive,
    status: updated.status,
  });
}
