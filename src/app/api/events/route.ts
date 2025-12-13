import { NextResponse } from 'next/server';
import { logEvent, EventType } from '@/lib/events';

export async function POST(req: Request) {
  try {
    const { conversationId, traceId, eventType, eventData } = await req.json();

    if (!conversationId || !eventType) {
      return NextResponse.json(
        { error: 'conversationId and eventType are required' },
        { status: 400 }
      );
    }

    await logEvent({
      conversationId,
      traceId,
      eventType: eventType as EventType,
      eventData: eventData || {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Events API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log event' },
      { status: 500 }
    );
  }
}
