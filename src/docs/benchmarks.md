# Benchmarks

Run with:

```bash
npm run benchmark
```

The runner submits signed webhook events at sizes 1000, 5000, and 10000, then samples `/metrics`.

| Events | Throughput | P95 latency | Success rate | Retry rate |
| ---: | ---: | ---: | ---: | ---: |
| 1000 | measured at runtime | measured at runtime | measured at runtime | measured at runtime |
| 5000 | measured at runtime | measured at runtime | measured at runtime | measured at runtime |
| 10000 | measured at runtime | measured at runtime | measured at runtime | measured at runtime |
