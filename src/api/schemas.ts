import { z } from 'zod';

export const eventSchema = z.object({
  event_id: z.string().min(1),
  correlation_id: z.string().min(1),
  request_id: z.string().min(1),
  destination_url: z.string().url().optional(),
  payload: z.unknown().refine((value) => value !== undefined, 'payload is required')
});

export const scheduleSchema = eventSchema.extend({
  deliver_after_ms: z.number().int().positive().optional(),
  deliver_at: z.string().datetime().optional()
}).refine((value) => value.deliver_after_ms !== undefined || value.deliver_at !== undefined, {
  message: 'deliver_after_ms or deliver_at is required',
  path: ['deliver_after_ms']
});

export const dlqReplaySchema = z.object({
  event_ids: z.array(z.string().min(1)).min(1)
});

export const simulationSchema = z.object({
  mode: z.enum(['off', 'fail20', 'fail50', 'alwaysFail', 'timeout', 'slow']),
  slowMs: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional()
});

export const benchmarkSchema = z.object({
  size: z.number().int().positive().max(100000)
});

export const signatureSchema = z.object({
  payload: z.string().min(1),
  secret: z.string().min(1)
});

export const jwtTokenSchema = z.object({
  subject: z.string().min(1).default('eventrelay-client'),
  roles: z.array(z.string().min(1)).optional(),
  expiresIn: z.string().min(1).default('1h')
});

export const jwtVerifySchema = z.object({
  token: z.string().min(1)
});
