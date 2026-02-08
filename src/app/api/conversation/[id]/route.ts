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
  const { deepDiveId } = await req.json();

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

  const updated = await prisma.conversation.update({
    where: { id },
    data: { deepDiveId: deepDiveId || null },
    include: {
      deepDive: {
        select: { id: true, topic: true },
      },
    },
  });

  return NextResponse.json({
    deepDiveId: updated.deepDiveId,
    deepDive: updated.deepDive,
  });
}
