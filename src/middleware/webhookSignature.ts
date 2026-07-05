import type { NextFunction, Response } from 'express';
import { env } from '../config/env';
import type { RawBodyRequest } from './rawBody';
import { verifySignature } from '../security/hmac';

export function verifyWebhookSignature(req: RawBodyRequest, res: Response, next: NextFunction): void {
  const signature = req.header('x-eventrelay-signature');
  
  // Use the raw Buffer if available, fallback to stringified body only if parsing failed entirely
  const body = req.rawBody ?? JSON.stringify(req.body ?? {});

  if (!verifySignature(body, signature, env.WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }
  
  next();
}