import { EventStatus } from '@prisma/client';
import { env } from '../config/env';
import { eventRepository } from '../db/repository';
import { eventQueue } from '../queue/eventQueue';
import { historyService } from '../history/historyService';
import type { EventEnvelope } from '../types';

export interface EventInput {
  event_id: string;
  correlation_id: string;
  request_id: string;
  destination_url?: string;
  payload: unknown;
}

export class EventIngestionService {
  async enqueue(input: EventInput, createdMessage: string) {
    const event = await eventRepository.createEvent(this.toEnvelope(input));
    if (event.history.length === 0) {
      await historyService.record(input.event_id, EventStatus.PENDING, createdMessage);
      await historyService.record(input.event_id, EventStatus.PENDING, 'Queued');
      await eventQueue.enqueue(input.event_id);
    }
    return { event_id: input.event_id, status: event.status };
  }

  async schedule(input: EventInput, runAt: Date) {
    const event = await eventRepository.createEvent(this.toEnvelope(input), EventStatus.PENDING);
    if (event.history.length === 0) {
      await historyService.record(input.event_id, EventStatus.PENDING, 'Created');
      const scheduled = await eventRepository.createScheduledJob(input.event_id, runAt);
      await historyService.record(input.event_id, EventStatus.PENDING, 'Scheduled', { runAt: runAt.toISOString() });
      return { event_id: input.event_id, scheduled_job_id: scheduled.id, run_at: runAt };
    }
    const existingSchedule = event.scheduledJobs?.[0];
    return { event_id: input.event_id, scheduled_job_id: existingSchedule?.id, run_at: existingSchedule?.runAt ?? runAt };
  }

  private toEnvelope(input: EventInput): EventEnvelope {
    return {
      event_id: input.event_id,
      correlation_id: input.correlation_id,
      request_id: input.request_id,
      destination_url: input.destination_url ?? env.DESTINATION_URL,
      payload: input.payload
    };
  }
}

export const eventIngestionService = new EventIngestionService();
