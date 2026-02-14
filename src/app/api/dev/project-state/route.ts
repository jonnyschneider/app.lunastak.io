import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const [conversations, fragmentCount, synthesesCount, generatedOutput] = await Promise.all([
    prisma.conversation.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        status: true,
        isInitialConversation: true,
        experimentVariant: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.fragment.count({ where: { projectId, status: 'active' } }),
    prisma.dimensionalSynthesis.count({ where: { projectId } }),
    prisma.generatedOutput.findFirst({
      where: { projectId },
      select: { id: true, version: true, status: true, outputType: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Load latest trace per conversation (for extractedContext needed by /generate)
  const traces = await prisma.trace.findMany({
    where: { projectId },
    select: {
      conversationId: true,
      extractedContext: true,
      dimensionalCoverage: true,
    },
    orderBy: { id: 'desc' },
  })

  // Map: conversationId → latest trace data
  const traceByConv = new Map<string, { extractedContext: unknown; dimensionalCoverage: unknown }>()
  for (const t of traces) {
    if (t.conversationId && !traceByConv.has(t.conversationId)) {
      traceByConv.set(t.conversationId, {
        extractedContext: t.extractedContext,
        dimensionalCoverage: t.dimensionalCoverage,
      })
    }
  }

  return NextResponse.json({
    projectId,
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      status: c.status,
      isInitialConversation: c.isInitialConversation,
      experimentVariant: c.experimentVariant,
      messageCount: c._count.messages,
      trace: traceByConv.get(c.id) || null,
    })),
    fragmentCount,
    synthesesCount,
    hasGeneratedOutput: !!generatedOutput,
    latestOutput: generatedOutput,
  })
}
