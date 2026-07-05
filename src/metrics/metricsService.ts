import { EventStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { eventQueue } from '../queue/eventQueue';

export class MetricsService {
  async snapshot() {
    const [queue, totals, retryCount, latencyRows, workerRows, scheduledCount] = await Promise.all([
      eventQueue.counts(),
      prisma.event.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.delivery.count({ where: { status: EventStatus.RETRYING } }),
      prisma.delivery.findMany({
        where: { latencyMs: { not: null } },
        select: { latencyMs: true, createdAt: true },
        orderBy: { latencyMs: 'asc' },
        take: 10000
      }),
      prisma.delivery.groupBy({
        by: ['workerId'],
        where: { workerId: { not: null } },
        _count: { workerId: true }
      }),
      prisma.scheduledJob.count({ where: { status: 'PENDING' } })
    ]);

    const totalEvents = totals.reduce((sum, row) => sum + row._count.status, 0);
    const delivered = totals.find((row) => row.status === EventStatus.DELIVERED)?._count.status ?? 0;
    const failed = totals.find((row) => row.status === EventStatus.FAILED)?._count.status ?? 0;
    const dlq = totals.find((row) => row.status === EventStatus.DLQ)?._count.status ?? 0;
    const latencies = latencyRows.map((row) => row.latencyMs ?? 0);
    const averageProcessingTime = latencies.length
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : 0;
    const p95Index = latencies.length ? Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1) : 0;
    const percentile = (ratio: number) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * ratio) - 1)] ?? 0 : 0;
    const oneMinuteAgo = Date.now() - 60_000;
    const recentEvents = latencyRows.filter((row) => row.createdAt.getTime() >= oneMinuteAgo).length;

    return {
      queue: {
        depth: (queue.waiting ?? 0) + (queue.delayed ?? 0) + scheduledCount,
        pendingJobs: queue.waiting ?? 0,
        delayedJobs: queue.delayed ?? 0,
        activeJobs: queue.active ?? 0,
        failedJobs: queue.failed ?? 0,
        scheduledJobs: scheduledCount,
        completedJobs: queue.completed ?? 0
      },
      reliability: {
        successRate: totalEvents ? delivered / totalEvents : 0,
        failureRate: totalEvents ? (failed + dlq) / totalEvents : 0,
        retryRate: totalEvents ? retryCount / totalEvents : 0,
        dlqRate: totalEvents ? dlq / totalEvents : 0,
        retryCount,
        dlqCount: dlq
      },
      performance: {
        averageProcessingTime,
        p50Latency: percentile(0.5),
        p95Latency: latencies[p95Index] ?? 0,
        p99Latency: percentile(0.99),
        eventsPerSecond: recentEvents / 60
      },
      workers: {
        activeWorkers: workerRows.length,
        workerUtilization: workerRows.map((row) => ({
          workerId: row.workerId,
          jobs: row._count.workerId
        }))
      },
      statuses: Object.fromEntries(totals.map((row) => [row.status, row._count.status]))
    };
  }
}

export const metricsService = new MetricsService();
