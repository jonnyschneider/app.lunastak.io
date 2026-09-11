import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess, isDenied } from '@/lib/auth/guard';
import { getShareState, setProjectSharing, ShareState } from '@/lib/share';

function shareUrl(request: NextRequest, state: ShareState): string | null {
  if (!state.shareToken) return null;
  return `${request.nextUrl.origin}/share/${state.shareToken}`;
}

/**
 * Share management is signed-up users only (guests are nudged to create an account in the UI
 * instead), owner only, and never a demo project — demos aren't user-shareable, so one answers
 * exactly like a project that isn't yours.
 */
async function requireShareableProject(projectId: string) {
  const auth = await requireProjectAccess(projectId, { guests: false });
  if (isDenied(auth)) return auth;
  if (auth.project.isDemo) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return auth;
}

/**
 * GET /api/project/[id]/share — current share state (owner only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireShareableProject(projectId);
  if (isDenied(auth)) return auth;

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
  const { id: projectId } = await params;
  const auth = await requireShareableProject(projectId);
  if (isDenied(auth)) return auth;

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
