import pino from 'pino';

export interface LogFields {
  eventId?: string;
  correlationId?: string;
  status?: string;
  worker?: string;
  latency?: number;
  timestamp?: string;
  attempt?: number;
  [key: string]: unknown;
}

export interface LogEntry extends LogFields {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export class Logger {
  private readonly entries: LogEntry[] = [];
  private readonly maxEntries = 300;
  private readonly base = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime
  });

  info(message: string, fields: LogFields = {}): void {
    this.remember('info', message, fields);
    this.base.info(fields, message);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.remember('warn', message, fields);
    this.base.warn(fields, message);
  }

  error(message: string, fields: LogFields = {}): void {
    this.remember('error', message, fields);
    this.base.error(fields, message);
  }

  recent(limit = 100): LogEntry[] {
    return this.entries.slice(-Math.max(1, Math.min(limit, this.maxEntries))).reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }

  private remember(level: LogEntry['level'], message: string, fields: LogFields): void {
    this.entries.push({ level, message, timestamp: new Date().toISOString(), ...fields });
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }
}

export const logger = new Logger();
