import { Readable, Writable } from 'node:stream';
import { ServerResponse } from 'node:http';
import type { Express } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signPayload } from '../security/hmac';

const enqueue = vi.fn();
const schedule = vi.fn();
const getEvent = vi.fn();
const metricsSnapshot = vi.fn();
const dlqList = vi.fn();
const dlqReplay = vi.fn();
const dlqDelete = vi.fn();
const queueExplorer = vi.fn();
const queueReset = vi.fn();
const workerSnapshot = vi.fn();
const workerReset = vi.fn();
const logsRecent = vi.fn();
const logsClear = vi.fn();
const logsInfo = vi.fn();
const logsError = vi.fn();
const logsWarn = vi.fn();
const benchmarkList = vi.fn();
const benchmarkRun = vi.fn();
const benchmarkClear = vi.fn();
const benchmarkProgress = vi.fn();
const resetDemo = vi.fn();
const upcomingScheduledJobs = vi.fn();
const recentDeliveries = vi.fn();
const clearDlq = vi.fn();

let simulationConfig = { mode: 'off', slowMs: 1, timeoutMs: 1 };
const simulationGet = vi.fn(() => simulationConfig);
const simulationSet = vi.fn((next) => {
  simulationConfig = { ...simulationConfig, ...next };
  return simulationConfig;
});
const simulationShouldFail = vi.fn(() => false);

vi.mock('../api/eventIngestionService', () => ({
  eventIngestionService: { enqueue, schedule }
}));
vi.mock('../db/repository', () => ({
  eventRepository: { getEvent, resetDemo, upcomingScheduledJobs, recentDeliveries, clearDlq }
}));
vi.mock('../metrics/metricsService', () => ({
  metricsService: { snapshot: metricsSnapshot }
}));
vi.mock('../dlq/dlqService', () => ({
  dlqService: { list: dlqList, replay: dlqReplay, delete: dlqDelete }
}));
vi.mock('../queue/eventQueue', () => ({
  eventQueue: { explorer: queueExplorer, reset: queueReset }
}));
vi.mock('../workers/workerRegistry', () => ({
  workerRegistry: { snapshot: workerSnapshot, reset: workerReset }
}));
vi.mock('../logger/logger', () => ({
  logger: { recent: logsRecent, clear: logsClear, info: logsInfo, error: logsError, warn: logsWarn }
}));
vi.mock('../benchmark/benchmarkService', () => ({
  benchmarkService: { list: benchmarkList, run: benchmarkRun, clear: benchmarkClear, progress: benchmarkProgress }
}));
vi.mock('../workers/failureSimulation', () => ({
  failureSimulation: { get: simulationGet, set: simulationSet, shouldFail: simulationShouldFail }
}));

describe('REST API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulationConfig = { mode: 'off', slowMs: 1, timeoutMs: 1 };
    enqueue.mockResolvedValue({ event_id: 'evt_1', status: 'PENDING' });
    schedule.mockResolvedValue({ event_id: 'evt_scheduled', scheduled_job_id: 'job_1', run_at: new Date('2026-01-01T00:00:05.000Z') });
    metricsSnapshot.mockResolvedValue({ queue: { depth: 0 }, reliability: {}, performance: {}, workers: {} });
    queueExplorer.mockResolvedValue({ counts: { waiting: 0, delayed: 0, active: 0 }, depth: 0, waiting: [], delayed: [], active: [], recent: [] });
    workerSnapshot.mockReturnValue({ activeWorkers: 0, workers: [] });
    logsRecent.mockReturnValue([{ level: 'info', message: 'ok', timestamp: new Date().toISOString() }]);
    benchmarkList.mockReturnValue([]);
    benchmarkProgress.mockReturnValue(null);
    benchmarkRun.mockResolvedValue({
      id: 'bench_1',
      events: 1000,
      accepted: 1000,
      failed: 0,
      throughput: 100,
      p95Latency: 5,
      successRate: 1,
      retryRate: 0,
      queueDepth: 0,
      executionTimeMs: 10,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      samples: []
    });
    dlqList.mockResolvedValue([{ eventId: 'evt_dlq' }]);
    dlqReplay.mockResolvedValue({ replayed: ['evt_dlq'] });
    dlqDelete.mockResolvedValue({ deleted: 'evt_dlq' });
    resetDemo.mockResolvedValue(undefined);
    upcomingScheduledJobs.mockResolvedValue([]);
    recentDeliveries.mockResolvedValue([]);
    clearDlq.mockResolvedValue({ count: 1 });
    queueReset.mockResolvedValue(undefined);
  });

  it('verifies the public REST endpoints', async () => {
    const { createApp } = await import('../api/app');
    const app = createApp();

    expect((await inject(app, 'POST', '/auth/token', { subject: 'client-a' })).body.token).toEqual(expect.any(String));

    expect(await inject(app, 'POST', '/events', eventBody('evt_1'))).toMatchObject({
      statusCode: 202,
      body: { event_id: 'evt_1', status: 'PENDING' }
    });

    getEvent.mockResolvedValueOnce({ eventId: 'evt_1', history: [], deliveries: [], scheduledJobs: [] });
    expect((await inject(app, 'GET', '/events/evt_1')).body.eventId).toBe('evt_1');

    getEvent.mockResolvedValueOnce(null);
    expect((await inject(app, 'GET', '/events/missing')).statusCode).toBe(404);

    expect((await inject(app, 'GET', '/metrics')).body.queue.depth).toBe(0);
    expect((await inject(app, 'GET', '/queue')).body.depth).toBe(0);
    expect((await inject(app, 'GET', '/workers')).body.activeWorkers).toBe(0);
    expect((await inject(app, 'GET', '/logs')).body[0].message).toBe('ok');

    expect((await inject(app, 'GET', '/dlq')).body[0].eventId).toBe('evt_dlq');

    expect((await inject(app, 'POST', '/dlq/replay', { event_ids: ['evt_dlq'] })).body.replayed).toEqual(['evt_dlq']);
    expect((await inject(app, 'POST', '/dlq/replay-all')).body.replayed).toEqual(['evt_dlq']);

    expect((await inject(app, 'DELETE', '/dlq/evt_dlq')).body.deleted).toBe('evt_dlq');
    expect((await inject(app, 'DELETE', '/dlq')).body.count).toBe(1);

    expect((await inject(app, 'POST', '/schedule', { ...eventBody('evt_scheduled'), deliver_after_ms: 5000 })).body.scheduled_job_id).toBe('job_1');
    expect((await inject(app, 'GET', '/schedule')).body).toEqual([]);

    expect((await inject(app, 'GET', '/simulation')).body.mode).toBe('off');

    expect((await inject(app, 'POST', '/simulation', { mode: 'fail20' })).body.mode).toBe('fail20');

    expect((await inject(app, 'POST', '/simulate/destination', { ok: true })).statusCode).toBe(200);
    expect((await inject(app, 'POST', '/signatures/hmac', { payload: '{}', secret: 'secret' })).body.signature).toEqual(expect.stringMatching(/^sha256=/));
    expect((await inject(app, 'GET', '/benchmarks')).body.history).toEqual([]);
    expect((await inject(app, 'POST', '/benchmarks/run', { size: 1000 })).body.events).toBe(1000);
    expect((await inject(app, 'POST', '/demo/reset')).body.ok).toBe(true);
    const token = (await inject(app, 'POST', '/auth/token', { subject: 'client-a', roles: ['admin'], expiresIn: '15m' })).body.token;
    expect((await inject(app, 'POST', '/auth/verify', { token })).body.valid).toBe(true);
  });

  it('requires valid HMAC signatures for webhook ingestion', async () => {
    const { createApp } = await import('../api/app');
    const app = createApp();
    const raw = JSON.stringify(eventBody('evt_signed'));
    const secret = process.env.WEBHOOK_SECRET ?? 'development-webhook-secret';

    expect((await injectRaw(app, 'POST', '/webhooks/events', raw)).statusCode).toBe(401);

    expect(
      (
        await injectRaw(app, 'POST', '/webhooks/events', raw, {
          'x-eventrelay-signature': `sha256=${signPayload(raw, secret)}`
        })
      ).statusCode,
    ).toBe(202);
  });
});

function eventBody(eventId: string) {
  return {
    event_id: eventId,
    correlation_id: `corr_${eventId}`,
    request_id: `req_${eventId}`,
    payload: { type: 'test.event' }
  };
}

async function inject(app: Express, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return injectRaw(app, method, url, body === undefined ? undefined : JSON.stringify(body), headers);
}

async function injectRaw(app: Express, method: string, url: string, rawBody?: string, headers: Record<string, string> = {}) {
  const body = rawBody ?? '';
  const chunks: Buffer[] = [];
  const socket = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    }
  });
  Object.assign(socket, {
    writable: true,
    destroy() {
      return socket;
    },
    cork() {},
    uncork() {}
  });

  let sent = false;
  const req = new Readable({
    read() {
      if (sent) return;
      sent = true;
      this.push(body);
      this.push(null);
    }
  }) as Readable & { method: string; url: string; headers: Record<string, string>; socket: Writable };
  req.method = method;
  req.url = url;
  req.headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body).toString(),
    ...headers
  };
  req.socket = socket;
  const res = new ServerResponse(req as never);
  res.assignSocket(socket as never);

  await new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    (app as unknown as { handle(request: Readable, response: ServerResponse): void }).handle(req, res);
  });

  const rawResponse = Buffer.concat(chunks).toString('utf8');
  const text = rawResponse.slice(rawResponse.indexOf('\r\n\r\n') + 4);
  return {
    statusCode: res.statusCode,
    headers: res.getHeaders(),
    text,
    body: text ? JSON.parse(text) : undefined
  };
}
