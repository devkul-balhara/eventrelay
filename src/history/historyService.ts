import type { EventStatus } from '@prisma/client';
import { eventRepository } from '../db/repository';

export class HistoryService {
  async record(eventId: string, status: EventStatus, message: string, metadata?: Record<string, unknown>) {
    return eventRepository.addHistory(eventId, { status, message, metadata });
  }
}

export const historyService = new HistoryService();
