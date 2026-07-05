import { createApp } from './api/app';
import { env } from './config/env';
import { logger } from './logger/logger';
import { schedulerService } from './scheduler/schedulerService';
import { DeliveryWorkerPool } from './workers/deliveryWorker';

const app = createApp();
const workerPool = new DeliveryWorkerPool(env.WORKER_CONCURRENCY);
workerPool.start(Number(process.env.WORKER_COUNT ?? 1));
schedulerService.start();

const server = app.listen(env.PORT, () => {
  logger.info('eventrelay started', { port: env.PORT, workers: workerPool.stats().configuredWorkers });
});

process.on('SIGTERM', async () => {
  schedulerService.stop();
  await workerPool.close();
  server.close(() => process.exit(0));
});
