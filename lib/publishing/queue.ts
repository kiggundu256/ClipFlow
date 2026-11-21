import "server-only";

import { Queue } from "bullmq";
import IORedis from "ioredis";

export const PUBLISHING_QUEUE_NAME = "clipflow-publishing";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required for the publishing queue.");

export const publishingConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

export type PublishTargetJob = { targetId: string } | { scan: true };

export const publishingQueue = new Queue<PublishTargetJob>(PUBLISHING_QUEUE_NAME, {
  connection: publishingConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
    removeOnFail: { age: 30 * 24 * 60 * 60 }
  }
});
