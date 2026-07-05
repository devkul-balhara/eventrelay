import { describe, expect, it } from 'vitest';
import { RetryEngine } from '../retry/retryEngine';

describe('RetryEngine', () => {
  it('uses exponential backoff and stops at the retry budget', () => {
    const engine = new RetryEngine({ baseDelayMs: 1000, maxRetries: 5 });
    const now = new Date('2026-01-01T00:00:00.000Z');

    expect(engine.decide(1, now).delayMs).toBe(1000);
    expect(engine.decide(2, now).delayMs).toBe(2000);
    expect(engine.decide(3, now).delayMs).toBe(4000);
    expect(engine.decide(4, now).delayMs).toBe(8000);
    expect(engine.decide(5, now).shouldRetry).toBe(false);
  });
});
