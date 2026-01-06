import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Hardcoded demo trace - public showcase
const DEMO_TRACE_ID = 'cmk1rfbur002qe0jn06m87680';

export async function GET() {
  const trace = await prisma.trace.findUnique({
    where: { id: DEMO_TRACE_ID },
  });

  if (!trace) {
    return NextResponse.json(
      { error: 'Demo strategy not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: 'demo-trace',
    output: trace.output,
    claudeThoughts: trace.claudeThoughts,
    conversationId: 'demo-conversation',
    timestamp: trace.timestamp,
  });
}
