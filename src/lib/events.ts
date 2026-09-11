import { prisma } from './db';

export type EventType =
  | 'fake_door_click'
  | 'info_icon_view'
  | 'extraction_choice'
  | 'entry_point_selected'
  | 'document_uploaded';

interface LogEventParams {
  conversationId: string;
  traceId?: string;
  eventType: EventType;
  eventData: Record<string, any>;
}

export async function logEvent({ conversationId, traceId, eventType, eventData }: LogEventParams) {
  try {
    await prisma.event.create({
      data: {
        conversationId,
        traceId,
        eventType,
        eventData,
      },
    });
    console.log(`[Event] ${eventType}:`, eventData);
  } catch (error) {
    // Don't fail the request if event logging fails
    console.error(`[Event] Failed to log ${eventType}:`, error);
  }
}
