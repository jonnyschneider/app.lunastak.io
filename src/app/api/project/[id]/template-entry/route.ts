import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';
import { planPipeline, executePipeline } from '@/lib/pipeline';
import type { StrategyStatements } from '@/lib/types';

const GUEST_COOKIE_NAME = 'guestUserId';

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  const cookieStore = await cookies();
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME);
  if (guestCookie?.value) {
    const guestUser = await prisma.user.findUnique({
      where: { id: guestCookie.value },
      select: { email: true },
    });
    if (guestUser && isGuestUser(guestUser.email)) {
      return guestCookie.value;
    }
  }
  return null;
}

/**
 * POST /api/project/[id]/template-entry
 * Creates a Decision Stack from user-provided template data
 * (inverse of conversation-first flow)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

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
