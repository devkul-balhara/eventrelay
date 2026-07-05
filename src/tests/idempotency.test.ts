import { EventStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { IdempotencyService } from '../security/idempotency';

describe('IdempotencyService', () => {
  it('treats delivered events with processed timestamps as already processed', async () => {
    const service = new IdempotencyService({
      async getEvent() {
        return { status: EventStatus.DELIVERED, processedAt: new Date() };
      }
    });

    await expect(service.isAlreadyProcessed('evt_1')).resolves.toBe(true);
  });
});
