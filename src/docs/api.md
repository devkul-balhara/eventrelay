# API

Base URL: `http://localhost:3000`

## POST /auth/token

Creates a JWT for clients.

```json
{ "subject": "client-a" }
```

## POST /events

Accepts an event and queues it for asynchronous delivery.

```json
{
  "event_id": "evt_1",
  "correlation_id": "corr_1",
  "request_id": "req_1",
  "destination_url": "https://example.com/webhook",
  "payload": { "type": "demo" }
}
```

## POST /webhooks/events

Same behavior as `/events`, protected by `x-eventrelay-signature`.
Signature format: `sha256=<hex hmac sha256 of raw JSON body>`.

## GET /events/:id

Returns event metadata, deliveries, scheduled jobs, and full timeline.

## GET /metrics

Returns queue depth, active jobs, success/failure rates, retry count, DLQ count, latency, events/sec, and worker utilization.

## GET /dlq

Lists events moved to the dead letter queue.

## POST /dlq/replay

```json
{ "event_ids": ["evt_1"] }
```

## DELETE /dlq/:id

Deletes one DLQ event by `event_id`.

## POST /schedule

```json
{
  "event_id": "evt_later",
  "correlation_id": "corr_later",
  "request_id": "req_later",
  "deliver_after_ms": 5000,
  "payload": { "type": "scheduled" }
}
```

Use `deliver_at` with an ISO timestamp instead of `deliver_after_ms` for absolute scheduling.

## GET /simulation

Returns the current failure simulation mode.

## POST /simulation

```json
{ "mode": "fail20" }
```

Supported modes: `off`, `fail20`, `fail50`, `alwaysFail`, `timeout`, `slow`.

## POST /simulate/destination

Internal configurable destination endpoint used by local development, Docker, benchmarks, and dashboard simulation.
