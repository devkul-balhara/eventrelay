import { EventStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dueScheduledJobs = vi.fn();
const markScheduledJobQueued = vi.fn();
const enqueue = vi.fn();
const record = vi.fn();

vi.mock('../db/repository', () => ({
  eventRepository: { dueScheduledJobs, markScheduledJobQueued }
}));
vi.mock('../queue/eventQueue', () => ({
  eventQueue: { enqueue }
}));
vi.mock('../history/historyService', () => ({
  historyService: { record }
}));

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues due scheduled jobs and marks them queued', async () => {
    const { SchedulerService } = await import('../scheduler/schedulerService');
    dueScheduledJobs.mockResolvedValue([{ id: 'job_1', eventId: 'evt_1' }]);

    const queued = await new SchedulerService().tick(new Date());

    expect(queued).toBe(1);
    expect(enqueue).toHaveBeenCalledWith('evt_1');
    expect(markScheduledJobQueued).toHaveBeenCalledWith('job_1');
    expect(record).toHaveBeenCalledWith('evt_1', EventStatus.PENDING, 'Scheduled event queued', { scheduledJobId: 'job_1' });
  });
});
