export interface WorkerSnapshot {
  workerId: string;
  status: 'idle' | 'processing';
  currentJob: string | null;
  concurrency: number;
  processedJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalLatencyMs: number;
  startedAt: string;
}

export class WorkerRegistry {
  private readonly workers = new Map<string, WorkerSnapshot>();

  register(workerId: string, concurrency: number): void {
    if (this.workers.has(workerId)) return;
    this.workers.set(workerId, {
      workerId,
      status: 'idle',
      currentJob: null,
      concurrency,
      processedJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalLatencyMs: 0,
      startedAt: new Date().toISOString()
    });
  }

  started(workerId: string, eventId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'processing';
    worker.currentJob = eventId;
  }

  finished(workerId: string, success = true, latencyMs = 0): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    worker.status = 'idle';
    worker.currentJob = null;
    worker.processedJobs += 1;
    worker.totalLatencyMs += Math.max(0, latencyMs);
    if (success) worker.successfulJobs += 1;
    else worker.failedJobs += 1;
  }

  snapshot() {
    const workers = [...this.workers.values()];
    return {
      activeWorkers: workers.filter((worker) => worker.status === 'processing').length,
      workers: workers.map((worker) => ({
        ...worker,
        averageLatency: worker.processedJobs ? Math.round(worker.totalLatencyMs / worker.processedJobs) : 0,
        successRate: worker.processedJobs ? worker.successfulJobs / worker.processedJobs : 0,
        utilization: worker.status === 'processing' ? 1 : 0,
        uptimeMs: Date.now() - new Date(worker.startedAt).getTime()
      }))
    };
  }

  reset(): void {
    for (const worker of this.workers.values()) {
      worker.status = 'idle';
      worker.currentJob = null;
      worker.processedJobs = 0;
      worker.successfulJobs = 0;
      worker.failedJobs = 0;
      worker.totalLatencyMs = 0;
    }
  }
}

export const workerRegistry = new WorkerRegistry();
