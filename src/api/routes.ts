import { Router } from 'express';
import { env } from '../config/env';
import { eventRepository } from '../db/repository';
import { dlqService } from '../dlq/dlqService';
import { metricsService } from '../metrics/metricsService';
import { failureSimulation } from '../workers/failureSimulation';
import { benchmarkSchema, eventSchema, jwtTokenSchema, jwtVerifySchema, scheduleSchema, dlqReplaySchema, signatureSchema, simulationSchema } from './schemas';
import { verifyWebhookSignature } from '../middleware/webhookSignature';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { eventIngestionService } from './eventIngestionService';
import { eventQueue } from '../queue/eventQueue';
import { logger } from '../logger/logger';
import { workerRegistry } from '../workers/workerRegistry';
import { benchmarkService } from '../benchmark/benchmarkService';
import { signPayload } from '../security/hmac';

export function createApiRouter(): Router {
  const router = Router();

  router.post('/auth/token', (req, res) => {
    const body = jwtTokenSchema.parse(req.body ?? {});
    const options: SignOptions = { expiresIn: body.expiresIn as SignOptions['expiresIn'] };
    res.json({
      token: jwt.sign({ sub: body.subject, roles: body.roles ?? [] }, env.JWT_SECRET, options)
    });
  });

  router.delete('/benchmarks', async (_req, res, next) => {
    try {
      await benchmarkService.clear();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/verify', (req, res, next) => {
    try {
      const body = jwtVerifySchema.parse(req.body);
      const decoded = jwt.decode(body.token, { complete: true });
      let valid = false;
      try {
        jwt.verify(body.token, env.JWT_SECRET);
        valid = true;
      } catch {
        valid = false;
      }
      res.json({ valid, decoded });
    } catch (error) {
      next(error);
    }
  });

  router.post('/webhooks/events', verifyWebhookSignature, async (req, res, next) => {
    try {
      const body = eventSchema.parse(req.body);
      res.status(202).json(await eventIngestionService.enqueue(body, 'Created via signed webhook'));
    } catch (error) {
      next(error);
    }
  });

  router.post('/events', async (req, res, next) => {
    try {
      const body = eventSchema.parse(req.body);
      res.status(202).json(await eventIngestionService.enqueue(body, 'Created'));
    } catch (error) {
      next(error);
    }
  });

  router.get('/events/:id', async (req, res, next) => {
    try {
      const event = await eventRepository.getEvent(req.params.id);
      if (!event) {
        res.status(404).json({ error: 'event not found' });
        return;
      }
      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  router.get('/metrics', async (_req, res, next) => {
    try {
      res.json(await metricsService.snapshot());
    } catch (error) {
      next(error);
    }
  });

  router.get('/queue', async (_req, res, next) => {
    try {
      const [queue, scheduled, recentDeliveries] = await Promise.all([
        eventQueue.explorer(),
        eventRepository.upcomingScheduledJobs(),
        eventRepository.recentDeliveries()
      ]);
      res.json({
        ...queue,
        depth: queue.depth + scheduled.length,
        scheduled: scheduled.map((job) => ({
          id: job.id,
          eventId: job.eventId,
          runAt: job.runAt,
          status: job.status,
          createdAt: job.createdAt,
          destinationUrl: job.event.destinationUrl
        })),
        recent: [
          ...queue.recent,
          ...recentDeliveries.map((delivery) => ({
            id: delivery.id,
            eventId: delivery.eventId,
            attemptsMade: delivery.attempt,
            status: delivery.status,
            workerId: delivery.workerId,
            latencyMs: delivery.latencyMs,
            createdAt: delivery.createdAt,
            finishedOn: delivery.createdAt.getTime(),
            failedReason: delivery.failureReason,
            destinationUrl: delivery.event.destinationUrl
          }))
        ].slice(0, 25)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/workers', (_req, res) => {
    res.json(workerRegistry.snapshot());
  });

  router.get('/logs', (req, res) => {
    res.json(logger.recent(Number(req.query.limit ?? 100)));
  });

  router.get('/dlq', async (req, res, next) => {
    try {
      res.json(await dlqService.list(Number(req.query.limit ?? 100)));
    } catch (error) {
      next(error);
    }
  });

  router.post('/dlq/replay', async (req, res, next) => {
    try {
      const body = dlqReplaySchema.parse(req.body);
      res.json(await dlqService.replay(body.event_ids));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/dlq/:id', async (req, res, next) => {
    try {
      res.json(await dlqService.delete(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/dlq/replay-all', async (_req, res, next) => {
    try {
      const events = await dlqService.list(1000);
      res.json(await dlqService.replay(events.map((event) => event.eventId)));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/dlq', async (_req, res, next) => {
    try {
      res.json(await eventRepository.clearDlq());
    } catch (error) {
      next(error);
    }
  });

  router.post('/schedule', async (req, res, next) => {
    try {
      const body = scheduleSchema.parse(req.body);
      const runAt = body.deliver_at
        ? new Date(body.deliver_at)
        : new Date(Date.now() + (body.deliver_after_ms ?? 0));

      res.status(202).json(await eventIngestionService.schedule(body, runAt));
    } catch (error) {
      next(error);
    }
  });

  router.get('/schedule', async (_req, res, next) => {
    try {
      res.json(await eventRepository.upcomingScheduledJobs());
    } catch (error) {
      next(error);
    }
  });

  router.get('/simulation', (_req, res) => {
    res.json(failureSimulation.get());
  });

  router.post('/simulation', (req, res, next) => {
    try {
      const body = simulationSchema.parse(req.body);
      res.json(failureSimulation.set(body));
    } catch (error) {
      next(error);
    }
  });

  router.post('/signatures/hmac', (req, res, next) => {
    try {
      const body = signatureSchema.parse(req.body);
      res.json({ signature: `sha256=${signPayload(body.payload, body.secret)}` });
    } catch (error) {
      next(error);
    }
  });

  router.get('/benchmarks', async (_req, res, next) => {
    try {
      res.json({ history: await benchmarkService.list(), current: benchmarkService.progress() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/benchmarks/run', async (req, res, next) => {
    try {
      const body = benchmarkSchema.parse(req.body);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.status(202).json(await benchmarkService.run(body.size, baseUrl, env.WEBHOOK_SECRET));
    } catch (error) {
      next(error);
    }
  });

  router.post('/demo/reset', async (_req, res, next) => {
    try {
      await eventQueue.reset();
      await eventRepository.resetDemo();
      workerRegistry.reset();
      failureSimulation.set({ mode: 'off', slowMs: 1500, timeoutMs: 5000 });
      logger.clear();
      logger.info('demo reset completed');
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/simulate/destination', async (_req, res) => {
    const config = failureSimulation.get();
    if (config.mode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, config.slowMs));
    }
    if (config.mode === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, config.timeoutMs));
      res.status(504).json({ error: 'simulated timeout' });
      return;
    }
    if (failureSimulation.shouldFail()) {
      res.status(503).json({ error: 'simulated failure' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
