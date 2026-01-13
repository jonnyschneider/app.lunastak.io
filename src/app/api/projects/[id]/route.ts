import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/projects/[id]
 * Hard deletes a project and all related data
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: session.user.id,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    // Delete in correct order to respect foreign keys
    // 1. Delete dimensional synthesis records
    await prisma.dimensionalSynthesis.deleteMany({
      where: { projectId },
    });

    // 2. Delete fragment dimension tags (via fragment cascade)
    // 3. Delete fragments
    await prisma.fragmentDimensionTag.deleteMany({
      where: { fragment: { projectId } },
    });
    await prisma.fragment.deleteMany({
      where: { projectId },
    });

    // 4. Delete conversation-related data
    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length > 0) {
      // Delete events
      await prisma.event.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete traces and feedbacks
      await prisma.feedback.deleteMany({
        where: { trace: { conversationId: { in: conversationIds } } },
      });
      await prisma.trace.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete messages
      await prisma.message.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });

      // Delete extraction runs
      await prisma.extractionRun.deleteMany({
        where: { projectId },
      });

      // Delete conversations
      await prisma.conversation.deleteMany({
        where: { projectId },
      });
    }

    // 5. Delete documents
    await prisma.document.deleteMany({
      where: { projectId },
    });

    // 6. Delete deep dives
    await prisma.deepDive.deleteMany({
      where: { projectId },
    });

    // 7. Delete generated outputs
    await prisma.generatedOutput.deleteMany({
      where: { projectId },
    });

    // 8. Delete user dismissals scoped to project
    await prisma.userDismissal.deleteMany({
      where: { projectId },
    });

    // 9. Finally delete the project
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
