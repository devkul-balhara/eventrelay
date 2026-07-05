import { EventStatus } from '@prisma/client';
import { eventRepository } from '../db/repository';
import { eventQueue } from '../queue/eventQueue';
import { historyService } from '../history/historyService';

export class DlqService {
  async moveToDlq(eventId: string, reason: string, attempt: number, workerId?: string) {
    await eventRepository.updateStatus(eventId, EventStatus.DLQ, attempt);
    await eventRepository.addDelivery({
      eventId,
      status: EventStatus.DLQ,
      attempt,
      failureReason: reason,
      workerId
    });
    await historyService.record(eventId, EventStatus.DLQ, 'Moved to dead letter queue', { reason, attempt });
  }

  async list(limit?: number) {
    return eventRepository.listDlq(limit);
  }

  async replay(eventIds: string[]) {
    const replayed: string[] = [];
    for (const eventId of eventIds) {
      await eventRepository.updateStatus(eventId, EventStatus.PENDING, 0);
      await historyService.record(eventId, EventStatus.PENDING, 'Replayed from dead letter queue');
      await eventQueue.enqueue(eventId);
      replayed.push(eventId);
    }
    return { replayed };
  }

  async delete(eventId: string) {
    await eventRepository.deleteDlq(eventId);
    return { deleted: eventId };
  }
}

export const dlqService = new DlqService();
