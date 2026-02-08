import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';
import {
  validateStrategyVersionInput,
  StrategyVersionInputContract,
} from '@/lib/contracts/strategy-version';

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
 * GET /api/project/[id]/strategy-version
 * Fetch latest versions for all components
 */
export async function GET(
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

  // Get latest version for each component
  const versions = await prisma.strategyVersion.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    distinct: ['componentType', 'componentId'],
  });

  return NextResponse.json({ versions });
}

/**
 * POST /api/project/[id]/strategy-version
 * Create a new version
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

  // Validate using contract
  if (!validateStrategyVersionInput(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { componentType, componentId, content, sourceType, sourceId } = body as StrategyVersionInputContract;

  // Get current max version for this component
  const latestVersion = await prisma.strategyVersion.findFirst({
    where: {
      projectId,
      componentType,
      componentId: componentId ?? null,
    },
    orderBy: { version: 'desc' },
  });

  const newVersion = (latestVersion?.version ?? 0) + 1;

  // Create the new version
  const version = await prisma.strategyVersion.create({
    data: {
      projectId,
      componentType,
      componentId: componentId ?? null,
      content: content as object,
      version: newVersion,
      createdBy: 'user',
      sourceType,
      sourceId: sourceId ?? null,
    },
  });

  return NextResponse.json({ version });
}
