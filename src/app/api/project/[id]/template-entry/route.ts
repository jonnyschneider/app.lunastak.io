import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';
import { waitUntil } from '@vercel/functions';
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
    // Create a conversation record for this template entry
    const conversation = await prisma.conversation.create({
      data: {
        projectId,
        userId,
        status: 'completed',
        title: 'Template Entry',
      },
    });

    // Create trace with the statements as output
    // Use a minimal extractedContext for template entries
    const templateContext = {
      source: 'template-entry',
      themes: [],
    };

    const trace = await prisma.trace.create({
      data: {
        conversationId: conversation.id,
        projectId,
        userId,
        extractedContext: templateContext,
        output: statements as object,
        claudeThoughts: 'User-provided template entry',
        modelUsed: 'template-entry',
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
    });

    // Seed StrategyVersion records
    const versionCreates = [
      // Vision version
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'vision',
          content: { text: statements.vision },
          version: 1,
          createdBy: 'user',
          sourceType: 'template',
          sourceId: trace.id,
        },
      }),
      // Strategy version
      prisma.strategyVersion.create({
        data: {
          projectId,
          componentType: 'strategy',
          content: { text: statements.strategy },
          version: 1,
          createdBy: 'user',
          sourceType: 'template',
          sourceId: trace.id,
        },
      }),
      // Objective versions
      ...statements.objectives.map((obj) =>
        prisma.strategyVersion.create({
          data: {
            projectId,
            componentType: 'objective',
            componentId: obj.id,
            content: {
              title: obj.title,
              pithy: obj.pithy,
              objective: obj.objective,
              omtm: obj.omtm,
              aspiration: obj.aspiration,
              explanation: obj.explanation,
            } as object,
            version: 1,
            createdBy: 'user',
            sourceType: 'template',
            sourceId: trace.id,
          },
        })
      ),
    ];

    await prisma.$transaction(versionCreates);

    // Create UserContent records for principles
    if (statements.principles && statements.principles.length > 0) {
      await prisma.userContent.createMany({
        data: statements.principles.map((principle) => ({
          projectId,
          type: 'principle',
          content: JSON.stringify(principle),
          status: 'complete',
        })),
      });
    }

    // Create GeneratedOutput record (mirrors /generate flow — drives hasStrategy + sidebar)
    await prisma.generatedOutput.create({
      data: {
        projectId,
        userId,
        outputType: 'full_decision_stack',
        version: 1,
        status: 'complete',
        content: statements as object,
        modelUsed: 'template-entry',
        startedAt: new Date(),
      },
    });

    console.log('[Template Entry] Created conversation, trace, output, and versions for project:', projectId);

    // Trigger post-hoc extraction in background (don't wait)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    waitUntil(
      fetch(`${baseUrl}/api/project/${projectId}/extract-from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements, traceId: trace.id }),
      }).catch((err) => console.error('[Template Entry] Post-hoc extraction failed:', err))
    );

    return NextResponse.json({ traceId: trace.id });
  } catch (error) {
    console.error('[Template Entry] Error:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
