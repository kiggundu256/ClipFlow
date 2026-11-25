import "server-only";

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getPublishingDefaultJobOptions } from "./retry-policy";

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
  defaultJobOptions: getPublishingDefaultJobOptions()
});
