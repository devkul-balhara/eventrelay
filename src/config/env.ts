import { z } from 'zod';
import { loadLocalEnv } from './loadEnv';

loadLocalEnv();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('postgresql://eventrelay:eventrelay@localhost:5432/eventrelay'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(8).default('development-secret'),
  WEBHOOK_SECRET: z.string().min(8).default('development-webhook-secret'),
  DESTINATION_URL: z.string().url().default('http://localhost:3000/simulate/destination'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  BASE_DELAY_MS: z.coerce.number().int().positive().default(1000),
  MAX_RETRIES: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_RPS: z.coerce.number().int().positive().default(50),
  WORKER_COUNT: z.coerce.number().int().positive().default(1)
});

export const env = schema.parse(process.env);
