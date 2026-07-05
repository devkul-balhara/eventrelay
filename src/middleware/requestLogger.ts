import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('http request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latency: Date.now() - started
    });
  });
  next();
}
