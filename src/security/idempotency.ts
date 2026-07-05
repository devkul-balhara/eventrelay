import { EventStatus } from '@prisma/client';

export interface EventStatusReader {
  getEvent(eventId: string): Promise<{ status: EventStatus; processedAt: Date | null } | null>;
}

export class IdempotencyService {
  constructor(private readonly reader: EventStatusReader) {}

  async isAlreadyProcessed(eventId: string): Promise<boolean> {
    const event = await this.reader.getEvent(eventId);
    return event?.status === EventStatus.DELIVERED && event.processedAt !== null;
  }
}
