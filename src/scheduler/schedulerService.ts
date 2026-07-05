import { eventRepository } from '../db/repository';
import { eventQueue } from '../queue/eventQueue';
import { historyService } from '../history/historyService';
import { EventStatus } from '@prisma/client';
import { logger } from '../logger/logger';

export class SchedulerService {
  private timer?: NodeJS.Timeout;

  start(intervalMs = 1000): void {
    this.timer = setInterval(() => {
      this.tick().catch((error) => logger.error('scheduler tick failed', { error: error.message }));
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<number> {
    const due = await eventRepository.dueScheduledJobs(now);
    for (const job of due) {
      await eventQueue.enqueue(job.eventId);
      await eventRepository.markScheduledJobQueued(job.id);
      await historyService.record(job.eventId, EventStatus.PENDING, 'Scheduled event queued', { scheduledJobId: job.id });
    }
    return due.length;
  }
}

export const schedulerService = new SchedulerService();
