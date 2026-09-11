import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireProjectAccess, isDenied } from '@/lib/auth/guard';
import {
  validateStrategyVersionInput,
  StrategyVersionInputContract,
} from '@/lib/contracts/strategy-version';
import {
  updateSingleton,
  updateComponent,
  getSnapshots,
} from '@/lib/decision-stack';

/**
 * GET /api/project/[id]/strategy-version
 * Fetch snapshot history (replaces per-component version history)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // Version history is readable on a demo project, like the rest of it.
  const auth = await requireProjectAccess(projectId, { access: 'read' });
  if (isDenied(auth)) return auth;

  const snapshots = await getSnapshots(projectId);

  // Only show post-snapshots in version history (pre-snapshots are internal bookkeeping)
  const postSnapshots = snapshots.filter(s => s.trigger.startsWith('post_'));
  const versions = postSnapshots.map((s, i) => ({
    id: s.id,
    version: postSnapshots.length - i, // newest = highest version number
    status: s.trigger,
    createdAt: s.createdAt.toISOString(),
    changeSummary: s.changeSummary || null,
  }));

  return NextResponse.json({ versions });
}

/**
 * POST /api/project/[id]/strategy-version
 * Create a new version (user edit) — writes to DecisionStack + creates StrategyVersion for audit
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const auth = await requireProjectAccess(projectId);
  if (isDenied(auth)) return auth;

  const body = await request.json();

  // Validate using contract
  if (!validateStrategyVersionInput(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { componentType, componentId, content, sourceType, sourceId } = body as StrategyVersionInputContract;

  // Write to Decision Stack
  if (componentType === 'vision') {
    const c = content as { text: string; elaboration?: string };
    await updateSingleton(projectId, 'vision', c.text, c.elaboration);
  } else if (componentType === 'strategy') {
    const c = content as { text: string; elaboration?: string };
    await updateSingleton(projectId, 'strategy', c.text, c.elaboration);
  } else if (componentType === 'objective' && componentId) {
    await updateComponent(projectId, 'objective', componentId, content as object);
  }

  // Also update Trace.output to persist the change for display
  const latestTrace = await prisma.trace.findFirst({
    where: {
      conversation: {
        projectId,
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  if (latestTrace) {
    const currentOutput = latestTrace.output as Record<string, unknown>;
    let updatedOutput = { ...currentOutput };

    if (componentType === 'vision') {
      updatedOutput.vision = (content as { text: string }).text;
    } else if (componentType === 'strategy') {
      updatedOutput.strategy = (content as { text: string }).text;
    } else if (componentType === 'objective' && componentId) {
      const objectives = (currentOutput.objectives || []) as Array<{ id: string; [key: string]: unknown }>;
      const exists = objectives.some((obj) => obj.id === componentId);
      if (exists) {
        updatedOutput.objectives = objectives.map((obj) =>
          obj.id === componentId
            ? { ...obj, ...(content as object) }
            : obj
        );
      } else {
        updatedOutput.objectives = [...objectives, { id: componentId, ...(content as object) }];
      }
    }

    await prisma.trace.update({
      where: { id: latestTrace.id },
      data: { output: updatedOutput as unknown as Parameters<typeof prisma.trace.update>[0]['data']['output'] },
    });
  }

  return NextResponse.json({ success: true, componentType, componentId });
}
