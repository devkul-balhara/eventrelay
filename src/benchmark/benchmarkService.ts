import { performance } from 'node:perf_hooks';
import { signPayload } from '../security/hmac';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BenchmarkResult {
  id: string;
  events: number;
  accepted: number;
  failed: number;
  throughput: number;
  p95Latency: number;
  successRate: number;
  retryRate: number;
  queueDepth: number;
  executionTimeMs: number;
  startedAt: string;
  completedAt: string;
  samples: Array<{ index: number; latency: number; throughput: number }>;
}

export class BenchmarkService {
  private current:
    | {
        id: string;
        size: number;
        accepted: number;
        failed: number;
        startedAt: string;
        running: boolean;
      }
    | null = null;

  async run(size: number, baseUrl: string, secret: string): Promise<BenchmarkResult> {
    const id = `bench_${Date.now()}`;
    const startedAt = new Date();
    const startedMs = performance.now();
    const latencies: number[] = [];
    const samples: BenchmarkResult['samples'] = [];
    let accepted = 0;
    let failed = 0;
    this.current = { id, size, accepted, failed, startedAt: startedAt.toISOString(), running: true };

    for (let i = 0; i < size; i += 1) {
      const body = JSON.stringify({
        event_id: `${id}_${i}`,
        correlation_id: `corr_${id}_${i}`,
        request_id: `req_${id}_${i}`,
        payload: { index: i, benchmark: id }
      });
      const requestStarted = performance.now();
      const response = await fetch(`${baseUrl}/webhooks/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-eventrelay-signature': `sha256=${signPayload(body, secret)}`
        },
        body
      });
      latencies.push(performance.now() - requestStarted);
      if (response.status === 202) accepted += 1;
      else failed += 1;
      this.current = { id, size, accepted, failed, startedAt: startedAt.toISOString(), running: true };
      if ((i + 1) % Math.max(1, Math.floor(size / 25)) === 0 || i === size - 1) {
        const elapsedSeconds = Math.max((performance.now() - startedMs) / 1000, 0.001);
        samples.push({ index: i + 1, latency: Number(latencies.at(-1)?.toFixed(2) ?? 0), throughput: Number(((i + 1) / elapsedSeconds).toFixed(2)) });
      }
    }

    const metrics = await fetch(`${baseUrl}/metrics`).then((response) => response.json());
    latencies.sort((a, b) => a - b);
    const executionTimeMs = Math.round(performance.now() - startedMs);
    
    const result: BenchmarkResult = {
      id,
      events: size,
      accepted,
      failed,
      throughput: Number((accepted / Math.max(executionTimeMs / 1000, 0.001)).toFixed(2)),
      p95Latency: Number((latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0).toFixed(2)),
      successRate: Number((accepted / size).toFixed(4)),
      retryRate: Number((metrics.reliability.retryCount / Math.max(accepted, 1)).toFixed(4)),
      queueDepth: metrics.queue.depth,
      executionTimeMs,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      samples
    };

    // Step 2 Core: Persist to PostgreSQL
    await (prisma as any).benchmarkRun.create({
      data: {
        id: result.id,
        events: result.events,
        throughput: result.throughput,
        p95Latency: result.p95Latency,
        successRate: result.successRate,
        retryRate: result.retryRate,
        queueDepth: result.queueDepth,
        executionTimeMs: result.executionTimeMs
      }
    });

    this.current = null;
    return result;
  }

  async list() {
    const runs = await (prisma as any).benchmarkRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Remap the DB result backward-compatibly so the frontend table doesn't break
    return runs.map((run: { events: number; successRate: number; createdAt: Date }) => ({
      ...run,
      accepted: Math.round(run.events * run.successRate),
      failed: run.events - Math.round(run.events * run.successRate),
      startedAt: run.createdAt.toISOString(),
      completedAt: run.createdAt.toISOString(),
      samples: []
    }));
  }

  progress() {
    return this.current;
  }

  async clear(): Promise<void> {
    await (prisma as any).benchmarkRun.deleteMany();
  }
}

export const benchmarkService = new BenchmarkService();