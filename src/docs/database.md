# Database Schema

## Events

Stores event identity, payload, destination, status, attempts, and timestamps.
`eventId` is unique and is the idempotency key.

## Deliveries

Stores every delivery attempt, response code, latency, retry timestamp, worker id, and failure reason.

## ScheduledJobs

Stores delayed delivery requests with due timestamp and status.

## EventHistory

Stores dashboard timeline entries for Created, Queued, Processing, Retrying, Delivered, Failed, and DLQ transitions.
