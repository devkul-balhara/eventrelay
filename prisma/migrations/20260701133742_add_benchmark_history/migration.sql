-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "events" INTEGER NOT NULL,
    "throughput" INTEGER NOT NULL,
    "p95Latency" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "retryRate" DOUBLE PRECISION NOT NULL,
    "queueDepth" INTEGER NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);
