import { Queue, QueueEvents } from 'bullmq';
import type { DeliveryJob } from '../types';
import { createRedisConnection } from './connection';

export const EVENT_QUEUE_NAME = 'eventrelay-delivery';

export class EventQueue {
  private readonly queue: Queue<DeliveryJob, void, 'deliver'>;
  private readonly queueEvents: QueueEvents;

  constructor() {
    const connection = createRedisConnection();
    this.queue = new Queue<DeliveryJob, void, 'deliver'>(EVENT_QUEUE_NAME, { connection });
    this.queueEvents = new QueueEvents(EVENT_QUEUE_NAME, { connection: createRedisConnection() });
  }

  async enqueue(eventId: string, delayMs = 0) {
    return this.queue.add(
      'deliver',
      { eventId },
      {
        jobId: `${eventId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        delay: delayMs,
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 1
      },
    );
  }

  async counts() {
    return this.queue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed', 'paused');
  }

  async explorer() {
    const [counts, waiting, delayed, active, completed, failed] = await Promise.all([
      this.counts(),
      this.queue.getJobs(['waiting'], 0, 9, false),
      this.queue.getJobs(['delayed'], 0, 9, false),
      this.queue.getJobs(['active'], 0, 9, false),
      this.queue.getJobs(['completed'], 0, 9, false),
      this.queue.getJobs(['failed'], 0, 9, false)
    ]);

    return {
      counts,
      depth: (counts.waiting ?? 0) + (counts.delayed ?? 0),
      waiting: waiting.map(toJobSummary),
      delayed: delayed.map(toJobSummary),
      active: active.map(toJobSummary),
      recent: [...completed, ...failed]
        .sort((a, b) => (b.finishedOn ?? b.timestamp) - (a.finishedOn ?? a.timestamp))
        .slice(0, 10)
        .map(toJobSummary)
    };
  }

  async reset(): Promise<void> {
    await this.queue.drain(true);
    await this.queue.clean(0, 1000, 'completed');
    await this.queue.clean(0, 1000, 'failed');
    await this.queue.clean(0, 1000, 'wait');
    await this.queue.clean(0, 1000, 'delayed');
  }

  async depth(): Promise<number> {
    const counts = await this.counts();
    return (counts.waiting ?? 0) + (counts.delayed ?? 0);
  }

  async close(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
  }
}

export const eventQueue = new EventQueue();

function toJobSummary(job: Awaited<ReturnType<Queue<DeliveryJob, void, 'deliver'>['getJobs']>>[number]) {
  return {
    id: job.id,
    name: job.name,
    eventId: job.data.eventId,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason
  };
}
