import { Worker } from 'bullmq';
import { EventStatus } from '@prisma/client';
import { env } from '../config/env';
import { eventRepository } from '../db/repository';
import { RetryEngine } from '../retry/retryEngine';
import { TokenBucket } from '../rateLimiter/tokenBucket';
import { EVENT_QUEUE_NAME, eventQueue } from '../queue/eventQueue';
import { createRedisConnection } from '../queue/connection';
import { historyService } from '../history/historyService';
import { dlqService } from '../dlq/dlqService';
import { logger } from '../logger/logger';
import type { DeliveryJob } from '../types';
import { IdempotencyService } from '../security/idempotency';
import { workerRegistry } from './workerRegistry';

export interface WorkerPoolStats {
  configuredWorkers: number;
  concurrency: number;
  processing: Set<string>;
}

export class DeliveryWorkerPool {
  private readonly retryEngine = new RetryEngine({ baseDelayMs: env.BASE_DELAY_MS, maxRetries: env.MAX_RETRIES });
  private readonly limiter = new TokenBucket(env.RATE_LIMIT_RPS, env.RATE_LIMIT_RPS);
  private readonly idempotency = new IdempotencyService(eventRepository);
  private readonly workers: Worker<DeliveryJob, void, 'deliver'>[] = [];
  private readonly processing = new Set<string>();

  constructor(private readonly concurrency = env.WORKER_CONCURRENCY) {}

  start(workerCount = 1): void {
    for (let i = 0; i < workerCount; i += 1) {
      const workerId = `worker-${i + 1}`;
      workerRegistry.register(workerId, this.concurrency);
      const worker = new Worker<DeliveryJob, void, 'deliver'>(
        EVENT_QUEUE_NAME,
        async (job) => this.process(job.data.eventId, workerId),
        { connection: createRedisConnection(), concurrency: this.concurrency },
      );
      worker.on('failed', (job, error) => logger.error('worker job failed', { eventId: job?.data.eventId, worker: workerId, error: error.message }));
      this.workers.push(worker);
    }
  }

  stats(): WorkerPoolStats {
    return { configuredWorkers: this.workers.length, concurrency: this.concurrency, processing: this.processing };
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private async process(eventId: string, workerId: string): Promise<void> {
    this.processing.add(eventId);
    workerRegistry.started(workerId, eventId);
    const started = Date.now();
    let success = false;

    try {
      const event = await eventRepository.getEvent(eventId);
      if (!event) throw new Error(`Event not found: ${eventId}`);
      if (await this.idempotency.isAlreadyProcessed(eventId)) return;

      const attempt = event.attempts + 1;
      const claimed = await eventRepository.claimForProcessing(eventId, attempt);
      if (claimed.count === 0) {
        logger.info('event skipped because it is not claimable', { eventId, status: event.status, worker: workerId });
        return;
      }
      await historyService.record(eventId, EventStatus.PROCESSING, 'Worker picked event', { workerId, attempt });

      const waitMs = this.limiter.waitTimeMs();
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.limiter.tryRemove();

      const response = await fetch(event.destinationUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-eventrelay-event-id': event.eventId,
          'x-eventrelay-correlation-id': event.correlationId,
          'x-eventrelay-request-id': event.requestId
        },
        body: JSON.stringify(event.payload)
      });

      const latency = Date.now() - started;
      if (!response.ok) {
        throw new Error(`Destination responded ${response.status}`);
      }

      await eventRepository.updateStatus(eventId, EventStatus.DELIVERED, attempt, new Date());
      await eventRepository.addDelivery({ eventId, status: EventStatus.DELIVERED, attempt, latencyMs: latency, responseCode: response.status, workerId });
      await historyService.record(eventId, EventStatus.DELIVERED, 'Delivered to destination', { responseCode: response.status, latency });
      logger.info('event delivered', { eventId, correlationId: event.correlationId, status: EventStatus.DELIVERED, worker: workerId, latency, attempt });
      success = true;
    } catch (error) {
      await this.handleFailure(eventId, workerId, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processing.delete(eventId);
      workerRegistry.finished(workerId, success, Date.now() - started);
    }
  }

  private async handleFailure(eventId: string, workerId: string, error: Error): Promise<void> {
    const event = await eventRepository.getEvent(eventId);
    const attempt = event?.attempts ?? 1;
    const decision = this.retryEngine.decide(attempt);
    const latency = 0;

    if (decision.shouldRetry && decision.retryAt && decision.delayMs !== undefined) {
      await eventRepository.updateStatus(eventId, EventStatus.RETRYING, attempt);
      await eventRepository.addDelivery({
        eventId,
        status: EventStatus.RETRYING,
        attempt,
        latencyMs: latency,
        failureReason: error.message,
        retryAt: decision.retryAt,
        workerId
      });
      await historyService.record(eventId, EventStatus.RETRYING, 'Scheduled retry', { reason: error.message, retryAt: decision.retryAt, attempt });
      await eventQueue.enqueue(eventId, decision.delayMs);
      logger.warn('event retry scheduled', { eventId, status: EventStatus.RETRYING, worker: workerId, attempt, error: error.message });
      return;
    }

    await eventRepository.updateStatus(eventId, EventStatus.FAILED, attempt);
    await historyService.record(eventId, EventStatus.FAILED, 'Delivery failed after retry budget', { reason: error.message, attempt });
    await dlqService.moveToDlq(eventId, error.message, attempt, workerId);
    logger.error('event moved to dlq', { eventId, status: EventStatus.DLQ, worker: workerId, attempt, error: error.message });
  }
}
