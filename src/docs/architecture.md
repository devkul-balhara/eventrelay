# Architecture

```mermaid
flowchart LR
  Client["REST Client"] --> API["Express API"]
  API --> PG[("PostgreSQL")]
  API --> Redis[("Redis Queue")]
  Redis --> Workers["BullMQ Worker Pool"]
  Workers --> RateLimiter["Token Bucket"]
  RateLimiter --> Destination["Destination Endpoint"]
  Workers --> Retry["Retry Engine"]
  Retry --> Redis
  Workers --> DLQ["Dead Letter Queue"]
  Scheduler["Scheduler"] --> PG
  Scheduler --> Redis
  Dashboard["HTML Dashboard"] --> API
```

EventRelay persists first, queues second, and records every status transition in event history. Delivery is idempotent by `event_id`; workers skip events already marked `DELIVERED` with `processedAt`.
