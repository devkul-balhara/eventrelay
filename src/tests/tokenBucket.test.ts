import { describe, expect, it } from 'vitest';
import { TokenBucket } from '../rateLimiter/tokenBucket';

describe('TokenBucket', () => {
  it('limits requests and refills over time', () => {
    const bucket = new TokenBucket(2, 2, 0);

    expect(bucket.tryRemove(1, 0)).toBe(true);
    expect(bucket.tryRemove(1, 0)).toBe(true);
    expect(bucket.tryRemove(1, 0)).toBe(false);
    expect(bucket.waitTimeMs(1, 0)).toBe(500);
    expect(bucket.tryRemove(1, 500)).toBe(true);
  });
});
