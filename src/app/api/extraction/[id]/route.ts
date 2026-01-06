import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try to find by ExtractionRun ID first
  let extractionRun = await prisma.extractionRun.findUnique({
    where: { id },
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

  // If not found, try to find by conversationId
  if (!extractionRun) {
    extractionRun = await prisma.extractionRun.findFirst({
      where: { conversationId: id },
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
  }

  // If still not found, try to find by traceId directly
  if (!extractionRun) {
    const trace = await prisma.trace.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { stepNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!trace) {
      return NextResponse.json(
        { error: 'Extraction run or trace not found' },
        { status: 404 }
      );
    }

    // Return trace-based response (no ExtractionRun)
    const fragments = trace.conversationId
      ? await prisma.fragment.findMany({
          where: { conversationId: trace.conversationId },
          include: { dimensionTags: true },
        })
      : [];

    const syntheses = trace.conversation?.projectId
      ? await prisma.dimensionalSynthesis.findMany({
          where: { projectId: trace.conversation.projectId },
        })
      : [];

    return NextResponse.json({
      extractionRun: null,
      fragments,
      syntheses,
      conversation: trace.conversation,
      generatedOutput: null,
      extractedContext: trace.extractedContext || null,
      dimensionalCoverage: trace.dimensionalCoverage || null,
      traceId: trace.id,
    });
  }

  // Fetch the trace to get extractedContext (the user-facing data)
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
    extractionRun,
    fragments,
    syntheses,
    conversation: extractionRun.conversation,
    generatedOutput: extractionRun.generatedOutput,
    // User-facing extraction data from trace
    extractedContext: trace?.extractedContext || null,
    dimensionalCoverage: trace?.dimensionalCoverage || null,
    traceId: trace?.id || null,
  });
}
