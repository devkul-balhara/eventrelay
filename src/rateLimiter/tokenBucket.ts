export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now = Date.now(),
  ) {
    if (capacity <= 0 || refillPerSecond <= 0) {
      throw new Error('Token bucket capacity and refill rate must be positive.');
    }
    this.tokens = capacity;
    this.updatedAt = now;
  }

  tryRemove(count = 1, now = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < count) {
      return false;
    }
    this.tokens -= count;
    return true;
  }

  waitTimeMs(count = 1, now = Date.now()): number {
    this.refill(now);
    if (this.tokens >= count) {
      return 0;
    }
    return Math.ceil(((count - this.tokens) / this.refillPerSecond) * 1000);
  }

  snapshot(now = Date.now()) {
    this.refill(now);
    return { tokens: this.tokens, capacity: this.capacity, refillPerSecond: this.refillPerSecond };
  }

  private refill(now: number): void {
    const elapsedMs = Math.max(0, now - this.updatedAt);
    const refill = (elapsedMs / 1000) * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + refill);
    this.updatedAt = now;
  }
}
