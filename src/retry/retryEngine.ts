export interface RetryPolicy {
  baseDelayMs: number;
  maxRetries: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  retryAt?: Date;
  delayMs?: number;
}

export class RetryEngine {
  constructor(private readonly policy: RetryPolicy) {}

  decide(attempt: number, now = new Date()): RetryDecision {
    if (attempt >= this.policy.maxRetries) {
      return { shouldRetry: false };
    }

    const delayMs = this.policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
    return {
      shouldRetry: true,
      delayMs,
      retryAt: new Date(now.getTime() + delayMs)
    };
  }
}
