import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireConversationAccess, deepDiveInProject, isDenied } from '@/lib/auth/guard';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // `read`, not the default `write`: a demo project's conversations open for anyone viewing it.
  const auth = await requireConversationAccess(id, { access: 'read' });
  if (isDenied(auth)) return auth;

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

  const auth = await requireConversationAccess(id); // write (the default): owner only — viewing a demo project doesn't let you change it
  if (isDenied(auth)) return auth;

  const { deepDiveId, status } = await req.json();

  // Build update data - only include fields that were provided
  const updateData: { deepDiveId?: string | null; status?: string } = {};
  if (deepDiveId !== undefined) {
    // Owning the conversation doesn't make any deep-dive id yours: only one of the conversation's
    // own project is accepted, or this door plants the conversation in someone else's deep dive.
    // A conversation with no project has no deep dives to join. Clearing (null) needs no check.
    if (deepDiveId) {
      const { projectId } = auth.conversation;
      if (!projectId || !(await deepDiveInProject(deepDiveId, projectId))) {
        return NextResponse.json(
          { error: 'Deep dive not found in this project' },
          { status: 400 }
        );
      }
    }
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
