import crypto from 'crypto';

export function signPayload(payload: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) {
    return false;
  }

  const expected = signPayload(payload, secret);
  // Safely trim hidden whitespace/newlines from the HTTP header before regex
  const actual = signature.trim().replace(/^sha256=/, '');
  
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}