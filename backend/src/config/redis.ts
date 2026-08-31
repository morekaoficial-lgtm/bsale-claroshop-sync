import Redis from "ioredis";
import Queue from "bull";
import { logger } from "../utils/logger";

// Cliente Redis para cache y pub/sub
export const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redisClient.on("error", (err) => {
  logger.error("Redis error:", err);
});

// ── Colas de sincronización (Bull) ──

export const productSyncQueue = new Queue("product-sync", process.env.REDIS_URL || "redis://localhost:6379", {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export const stockSyncQueue = new Queue("stock-sync", process.env.REDIS_URL || "redis://localhost:6379", {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const orderImportQueue = new Queue("order-import", process.env.REDIS_URL || "redis://localhost:6379", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const retryQueue = new Queue("retry-dead-letter", process.env.REDIS_URL || "redis://localhost:6379", {
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 60000 }, // 1 min base
    removeOnComplete: 50,
    removeOnFail: 500,
  },
});

// Logging de eventos de colas
[productSyncQueue, stockSyncQueue, orderImportQueue, retryQueue].forEach((queue) => {
  queue.on("failed", (job, err) => {
    logger.error(`Job ${job.id} en ${queue.name} falló:`, err.message);
  });
  queue.on("completed", (job) => {
    logger.info(`Job ${job.id} en ${queue.name} completado`);
  });
});
