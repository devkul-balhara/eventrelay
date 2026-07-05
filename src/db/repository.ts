import { EventStatus, Prisma, ScheduledJobStatus } from '@prisma/client';
import { prisma } from './prisma';
import type { EventEnvelope, TimelineItem } from '../types';

export class EventRepository {
  async createEvent(input: EventEnvelope, status: EventStatus = EventStatus.PENDING) {
    return prisma.event.upsert({
      where: { eventId: input.event_id },
      update: {},
      create: {
        eventId: input.event_id,
        correlationId: input.correlation_id,
        requestId: input.request_id,
        destinationUrl: input.destination_url,
        payload: input.payload as Prisma.InputJsonValue,
        status
      },
      include: { history: true, scheduledJobs: { orderBy: { createdAt: 'asc' }, take: 1 } }
    });
  }

  async getEvent(eventId: string) {
    return prisma.event.findUnique({
      where: { eventId },
      include: { deliveries: { orderBy: { createdAt: 'asc' } }, history: { orderBy: { createdAt: 'asc' } }, scheduledJobs: true }
    });
  }

  async updateStatus(eventId: string, status: EventStatus, attempts?: number, processedAt?: Date) {
    return prisma.event.update({ where: { eventId }, data: { status, attempts, processedAt } });
  }

  async claimForProcessing(eventId: string, attempt: number) {
    return prisma.event.updateMany({
      where: { eventId, status: { in: [EventStatus.PENDING, EventStatus.RETRYING] } },
      data: { status: EventStatus.PROCESSING, attempts: attempt }
    });
  }

  async addDelivery(data: {
    eventId: string;
    status: EventStatus;
    attempt: number;
    latencyMs?: number;
    responseCode?: number;
    failureReason?: string;
    retryAt?: Date;
    workerId?: string;
  }) {
    return prisma.delivery.create({ data });
  }

  async addHistory(eventId: string, item: TimelineItem) {
    return prisma.eventHistory.create({
      data: {
        eventId,
        status: item.status,
        message: item.message,
        metadata: item.metadata as Prisma.InputJsonValue
      }
    });
  }

  async createScheduledJob(eventId: string, runAt: Date) {
    return prisma.scheduledJob.create({ data: { eventId, runAt } });
  }

  async dueScheduledJobs(now = new Date()) {
    return prisma.scheduledJob.findMany({
      where: { status: ScheduledJobStatus.PENDING, runAt: { lte: now } },
      include: { event: true },
      orderBy: { runAt: 'asc' },
      take: 100
    });
  }

  async markScheduledJobQueued(id: string) {
    return prisma.scheduledJob.update({ where: { id }, data: { status: ScheduledJobStatus.QUEUED } });
  }

  async listDlq(limit = 100) {
    return prisma.event.findMany({
      where: { status: EventStatus.DLQ },
      include: { deliveries: { orderBy: { createdAt: 'asc' } }, history: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });
  }

  async deleteDlq(eventId: string) {
    return prisma.event.delete({ where: { eventId } });
  }

  async clearDlq() {
    return prisma.event.deleteMany({ where: { status: EventStatus.DLQ } });
  }

  async upcomingScheduledJobs(limit = 50) {
    return prisma.scheduledJob.findMany({
      where: { status: ScheduledJobStatus.PENDING },
      include: { event: true },
      orderBy: { runAt: 'asc' },
      take: limit
    });
  }

  async recentDeliveries(limit = 20) {
    return prisma.delivery.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async resetDemo() {
    await prisma.eventHistory.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.scheduledJob.deleteMany();
    await prisma.event.deleteMany();
  }
}

export const eventRepository = new EventRepository();
