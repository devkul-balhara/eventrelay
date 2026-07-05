import { EventStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateStatus = vi.fn();
const addDelivery = vi.fn();
const listDlq = vi.fn();
const deleteDlq = vi.fn();
const enqueue = vi.fn();
const record = vi.fn();

vi.mock('../db/repository', () => ({
  eventRepository: { updateStatus, addDelivery, listDlq, deleteDlq }
}));
vi.mock('../queue/eventQueue', () => ({
  eventQueue: { enqueue }
}));
vi.mock('../history/historyService', () => ({
  historyService: { record }
}));

describe('DlqService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves exhausted events to DLQ with failure context', async () => {
    const { DlqService } = await import('../dlq/dlqService');

    await new DlqService().moveToDlq('evt_1', 'boom', 5, 'worker-1');

    expect(updateStatus).toHaveBeenCalledWith('evt_1', EventStatus.DLQ, 5);
    expect(addDelivery).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1', failureReason: 'boom' }));
  });

  it('replays DLQ events by resetting status and enqueueing', async () => {
    const { DlqService } = await import('../dlq/dlqService');

    await expect(new DlqService().replay(['evt_1'])).resolves.toEqual({ replayed: ['evt_1'] });
    expect(updateStatus).toHaveBeenCalledWith('evt_1', EventStatus.PENDING, 0);
    expect(enqueue).toHaveBeenCalledWith('evt_1');
  });
});
