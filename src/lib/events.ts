import { prisma } from './db';

export type EventType =
  | 'fake_door_click'
  | 'info_icon_view'
  | 'extraction_choice'
  | 'quality_rating';

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

export async function logQualityRating(traceId: string, rating: 'good' | 'bad') {
  try {
    await prisma.trace.update({
      where: { id: traceId },
      data: {
        qualityRating: rating,
        qualityRatingTimestamp: new Date(),
      },
    });
    console.log(`[Quality Rating] ${rating} for trace ${traceId}`);
  } catch (error) {
    console.error('[Quality Rating] Failed to save:', error);
    throw error;
  }
}
