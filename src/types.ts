import type { EventStatus } from '@prisma/client';

export interface EventEnvelope {
  event_id: string;
  correlation_id: string;
  request_id: string;
  destination_url: string;
  payload: unknown;
}

export interface DeliveryJob {
  eventId: string;
}

export interface TimelineItem {
  status: EventStatus;
  message: string;
  metadata?: Record<string, unknown>;
}
