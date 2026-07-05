import { describe, expect, it, vi } from 'vitest';

const add = vi.fn();
const getJobCounts = vi.fn();
const closeQueue = vi.fn();
const closeEvents = vi.fn();

vi.mock('ioredis', () => ({ default: vi.fn(() => ({})) }));
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add, getJobCounts, close: closeQueue })),
  QueueEvents: vi.fn(() => ({ close: closeEvents }))
}));

describe('EventQueue', () => {
  it('enqueues delivery jobs and reports depth', async () => {
    const { EventQueue } = await import('../queue/eventQueue');
    getJobCounts.mockResolvedValue({ waiting: 3, delayed: 2, active: 1 });
    const queue = new EventQueue();

    await queue.enqueue('evt_1', 1000);

    expect(add).toHaveBeenCalledWith('deliver', { eventId: 'evt_1' }, expect.objectContaining({ delay: 1000 }));
    await expect(queue.depth()).resolves.toBe(5);
  });
});
