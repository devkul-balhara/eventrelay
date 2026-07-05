import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { ZodError } from 'zod';
import { createApiRouter } from './routes';
import { captureRawBody } from '../middleware/rawBody';
import { logger } from '../logger/logger';
import { allowCors, securityHeaders } from '../middleware/securityHeaders';
import { requestLogger } from '../middleware/requestLogger';

export function createApp() {
  const app = express();
  app.use(securityHeaders);
  app.use(allowCors);
  app.use(express.json({ verify: captureRawBody, limit: '1mb' }));
  app.use(requestLogger);

  // Serves the front-end dashboard
  app.use('/dashboard', express.static(path.join(process.cwd(), 'src/dashboard')));
  app.get('/', (_req, res) => res.redirect('/dashboard'));
  
  // Mount the router directly so that absolute paths starting from root match correctly
  app.use('/', createApiRouter());

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (error instanceof ZodError) {
      res.status(400).json({ error: 'validation failed', details: error.flatten() });
      return;
    }
    const message = error instanceof Error ? error.message : 'internal error';
    logger.error('request failed', { error: message });
    res.status(500).json({ error: message });
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'EventRelay',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  return app;
}