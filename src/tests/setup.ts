import { vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  EventStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    RETRYING: 'RETRYING',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    DLQ: 'DLQ'
  },
  ScheduledJobStatus: {
    PENDING: 'PENDING',
    QUEUED: 'QUEUED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
  },
  Prisma: {},
  PrismaClient: vi.fn(() => ({}))
}));
