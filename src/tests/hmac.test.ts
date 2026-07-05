import { describe, expect, it } from 'vitest';
import { signPayload, verifySignature } from '../security/hmac';

describe('HMAC signatures', () => {
  it('verifies valid signatures and rejects tampering', () => {
    const payload = JSON.stringify({ event_id: 'evt_1' });
    const signature = signPayload(payload, 'secret');

    expect(verifySignature(payload, `sha256=${signature}`, 'secret')).toBe(true);
    expect(verifySignature(`${payload}x`, `sha256=${signature}`, 'secret')).toBe(false);
  });
});
