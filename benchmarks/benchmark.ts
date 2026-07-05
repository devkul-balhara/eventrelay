import { benchmarkService } from '../src/benchmark/benchmarkService';
import { env } from '../src/config/env';

const baseUrl = process.env.BENCHMARK_URL ?? `http://localhost:${env.PORT}`;
const sizes = [1000, 5000, 10000];

async function main() {
  const rows = [];
  for (const size of sizes) {
    const result = await benchmarkService.run(size, baseUrl, env.WEBHOOK_SECRET);
    rows.push({
      events: result.events,
      accepted: result.accepted,
      failed: result.failed,
      throughputPerSec: result.throughput,
      p95RequestLatencyMs: result.p95Latency,
      successRate: `${Math.round(result.successRate * 100)}%`,
      retryRate: `${Math.round(result.retryRate * 100)}%`,
      queueDepth: result.queueDepth,
      executionTimeMs: result.executionTimeMs
    });
  }
  console.table(rows);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
