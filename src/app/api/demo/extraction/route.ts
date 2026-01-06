import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Hardcoded demo conversation - public showcase
const DEMO_CONVERSATION_ID = 'cmk1tr94r0010lvzgnlpt8n3z';

export async function GET() {
  // Find extraction run for the demo conversation
  const extractionRun = await prisma.extractionRun.findFirst({
    where: { conversationId: DEMO_CONVERSATION_ID },
    orderBy: { createdAt: 'desc' },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      },
      generatedOutput: true,
    },
  });

  if (!extractionRun) {
    return NextResponse.json(
      { error: 'Demo extraction not found' },
      { status: 404 }
    );
  }

  // Fetch the trace to get extractedContext
  const trace = await prisma.trace.findFirst({
    where: { conversationId: extractionRun.conversationId! },
    orderBy: { timestamp: 'desc' },
  });

  // Fetch fragments for this extraction
  const fragments = await prisma.fragment.findMany({
    where: {
      id: { in: extractionRun.fragmentIds },
    },
    include: {
      dimensionTags: true,
    },
  });

  // Fetch current syntheses for the project
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: { projectId: extractionRun.projectId },
  });

  return NextResponse.json({
    extractionRun: {
      ...extractionRun,
      // Redact sensitive IDs for public demo
      id: 'demo-extraction',
      projectId: 'demo-project',
    },
    fragments: fragments.map((f) => ({
      ...f,
      id: `demo-${f.id.slice(-8)}`,
      projectId: 'demo-project',
    })),
    syntheses: syntheses.map((s) => ({
      ...s,
      id: `demo-${s.id.slice(-8)}`,
      projectId: 'demo-project',
    })),
    conversation: extractionRun.conversation
      ? {
          ...extractionRun.conversation,
          id: 'demo-conversation',
          userId: null,
          projectId: 'demo-project',
        }
      : null,
    generatedOutput: extractionRun.generatedOutput,
    extractedContext: trace?.extractedContext || null,
    dimensionalCoverage: trace?.dimensionalCoverage || null,
    traceId: 'demo-trace',
  });
}
