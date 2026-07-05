# Design Decisions and Tradeoffs

- BullMQ on Redis provides durable asynchronous delivery without Kafka/RabbitMQ complexity.
- PostgreSQL remains the source of truth for event state, attempts, delivery history, scheduled jobs, and DLQ inspection.
- Retry scheduling is application controlled so retry count, retry timestamp, and history are queryable.
- Token bucket rate limiting protects destination endpoints with predictable requests-per-second limits.
- Dashboard uses plain HTML/CSS/JavaScript and polls `/metrics` for live updates.
- The service is a modular monolith. It avoids distributed transactions and leader election; operational simplicity wins here.

## Complexity

- Enqueue: O(1)
- Worker delivery: O(1) database updates plus destination network latency
- Metrics: O(n) over recent delivery rows used for latency calculation
- Scheduler tick: O(k) for due jobs, capped at 100 jobs per tick
