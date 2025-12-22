import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { stepNumber: 'asc' },
    });

    // Filter out system messages (stepNumber 0)
    const userMessages = messages.filter(m => m.stepNumber > 0);

    return NextResponse.json({
      messages: userMessages,
    });

  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
