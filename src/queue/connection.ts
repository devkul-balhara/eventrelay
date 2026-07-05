import type { ConnectionOptions } from 'bullmq';
import { env } from '../config/env';

export function createRedisConnection(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  const isTLS = url.protocol === 'rediss:';

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    family: 4, // Forces IPv4 to stop Render DNS resolution hangs
    tls: isTLS ? { rejectUnauthorized: false } : undefined // Explicitly forces Upstash TLS handshake
  };
}