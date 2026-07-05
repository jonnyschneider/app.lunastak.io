import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getShareState, setProjectSharing, ShareState } from '@/lib/share';

/**
 * Share management is signed-up-users only — session auth, no guest cookie
 * path. Guests are nudged to create an account in the UI instead.
 */
async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function shareUrl(request: NextRequest, state: ShareState): string | null {
  if (!state.shareToken) return null;
  return `${request.nextUrl.origin}/share/${state.shareToken}`;
}

async function requireOwnedProject(projectId: string, userId: string) {
  // Strict owner check — no isDemo OR, demos are not user-shareable
  return prisma.project.findFirst({
    where: { id: projectId, userId, isDemo: false },
    select: { id: true },
  });
}

/**
 * GET /api/project/[id]/share — current share state (owner only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await requireOwnedProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const state = await getShareState(projectId);
  if (!state) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    enabled: state.enabled,
    shareUrl: shareUrl(request, state),
  });
}

/**
 * POST /api/project/[id]/share — toggle sharing (owner only)
 * Body: { enabled: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await requireOwnedProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const state = await setProjectSharing(projectId, body.enabled);

  return NextResponse.json({
    enabled: state.enabled,
    shareUrl: shareUrl(request, state),
  });
}
