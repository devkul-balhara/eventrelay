import { env } from '../config/env';
import { DeliveryWorkerPool } from './deliveryWorker';
import { logger } from '../logger/logger';

const pool = new DeliveryWorkerPool(env.WORKER_CONCURRENCY);
pool.start(Number(process.env.WORKER_COUNT ?? 1));
logger.info('worker pool started', { workers: pool.stats().configuredWorkers, concurrency: env.WORKER_CONCURRENCY });

process.on('SIGTERM', async () => {
  await pool.close();
  process.exit(0);
});
