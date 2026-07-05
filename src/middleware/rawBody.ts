import type { Request, Response } from 'express';

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function captureRawBody(req: Request, _res: Response, buffer: Buffer): void {
  // Copy the buffer to prevent it from being mutated or garbage collected
  (req as RawBodyRequest).rawBody = Buffer.from(buffer);
}