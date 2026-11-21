import "dotenv/config";

import { Job, UnrecoverableError, Worker } from "bullmq";
import IORedis from "ioredis";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prisma } from "../lib/prisma";
import { PUBLISHING_QUEUE_NAME, publishingQueue, type PublishTargetJob } from "../lib/publishing/queue";
import { getPublishingAdapter } from "../lib/publishing/adapters";
import { getValidGoogleAccessToken } from "../lib/oauth/google";
import { getValidInstagramAccessToken } from "../lib/oauth/instagram";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required to run the publishing worker.");
if (process.env.CLIPFLOW_PUBLISHING_ENABLED !== "true") {
  throw new Error("Publishing worker is disabled. Set CLIPFLOW_PUBLISHING_ENABLED=true only after provider adapters are configured.");
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
const mediaDirectory = resolve(process.env.CLIPFLOW_MEDIA_DIR || join(process.cwd(), "private-media"));

async function enqueueDueTargets() {
  const now = new Date();
  const duePosts = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, workspaceId: true, targets: { select: { id: true } } },
    take: 100,
    orderBy: { scheduledAt: "asc" }
  });

  for (const post of duePosts) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.post.updateMany({
        where: { id: post.id, status: "SCHEDULED", scheduledAt: { lte: now } },
        data: { status: "QUEUED" }
      });
      if (claimed.count !== 1) return;

      if (post.targets.length === 0) {
        await tx.post.update({
          where: { id: post.id },
          data: { status: "FAILED", lastError: "No publishing channels were selected for this post." }
        });
        await tx.auditEvent.create({
          data: {
            workspaceId: post.workspaceId,
            action: "post.publishing_failed",
            targetType: "Post",
            targetId: post.id,
            metadata: { code: "NO_TARGETS" }
          }
        });
        return;
      }

      await tx.postTarget.updateMany({
        where: { postId: post.id, status: "PENDING" },
        data: { status: "QUEUED" }
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: post.workspaceId,
          action: "post.queued",
          targetType: "Post",
          targetId: post.id,
          metadata: { targetCount: post.targets.length }
        }
      });
    });
  }

  // Re-enqueue QUEUED targets on every scan. Deterministic job IDs make this safe if
  // the process exits after the DB transaction but before Redis receives the job.
  const queuedTargets = await prisma.postTarget.findMany({
    where: { status: "QUEUED", post: { status: "QUEUED", scheduledAt: { lte: now } } },
    select: { id: true },
    take: 500,
    orderBy: { createdAt: "asc" }
  });

  for (const target of queuedTargets) {
    await publishingQueue.add("publish-target", { targetId: target.id }, { jobId: `publish-${target.id}` });
  }
}

async function publishTarget(job: Job<PublishTargetJob>) {
  const target = await prisma.postTarget.findUnique({
    where: { id: job.data.targetId },
    include: {
      post: { include: { mediaAsset: true } },
      socialAccount: true
    }
  });
  if (!target || target.status === "PUBLISHED" || target.status === "CANCELED") return;

  const adapter = getPublishingAdapter(target.socialAccount.platform);
  if (!adapter) {
    throw new UnrecoverableError(`No verified ${target.socialAccount.platform} publishing adapter is configured.`);
  }

  const claimed = await prisma.postTarget.updateMany({
    where: { id: target.id, status: "QUEUED" },
    data: { status: "PUBLISHING", lastError: null }
  });
  if (claimed.count !== 1) return;

  const attempt = await prisma.publishingAttempt.create({
    data: { postId: target.postId, postTargetId: target.id, status: "PROCESSING" }
  });

  try {
    let accessToken: string;
    if (target.socialAccount.platform === "YOUTUBE") {
      accessToken = await getValidGoogleAccessToken(target.socialAccountId);
    } else if (target.socialAccount.platform === "INSTAGRAM") {
      accessToken = await getValidInstagramAccessToken(target.socialAccountId);
    } else {
      throw new UnrecoverableError("TikTok publishing is not enabled for this account.");
    }

    const mediaPath = target.post.mediaAsset
      ? join(mediaDirectory, target.post.mediaAsset.storageKey)
      : null;
    if (mediaPath) await access(mediaPath);
    const result = await adapter.publish({
      platformAccountId: target.socialAccount.platformAccountId,
      accessToken,
      caption: target.post.caption,
      mediaPath,
      mimeType: target.post.mediaAsset?.mimeType ?? null,
      fileName: target.post.mediaAsset?.fileName ?? null
    });

    await prisma.$transaction(async (tx) => {
      await tx.publishingAttempt.update({
        where: { id: attempt.id },
        data: { status: "SUCCEEDED", platformPostId: result.platformPostId, finishedAt: new Date() }
      });
      await tx.postTarget.update({
        where: { id: target.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null }
      });
      const remaining = await tx.postTarget.count({
        where: { postId: target.postId, status: { in: ["PENDING", "QUEUED", "PUBLISHING"] } }
      });
      const failures = await tx.postTarget.count({ where: { postId: target.postId, status: "FAILED" } });
      if (remaining === 0) {
        await tx.post.update({
          where: { id: target.postId },
          data: { status: failures ? "FAILED" : "PUBLISHED", publishedAt: failures ? null : new Date() }
        });
      } else {
        await tx.post.update({ where: { id: target.postId }, data: { status: "PUBLISHING" } });
      }
      await tx.auditEvent.create({
        data: {
          workspaceId: target.post.workspaceId,
          action: "post.target_published",
          targetType: "PostTarget",
          targetId: target.id,
          metadata: { platform: target.socialAccount.platform, platformPostId: result.platformPostId }
        }
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    await prisma.$transaction(async (tx) => {
      await tx.publishingAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", errorMessage: message.slice(0, 1000), finishedAt: new Date() }
      });
      await tx.postTarget.update({
        where: { id: target.id },
        data: { status: "QUEUED", lastError: message.slice(0, 1000) }
      });
    });
    throw error;
  }
}

const worker = new Worker<PublishTargetJob>(
  PUBLISHING_QUEUE_NAME,
  async (job) => {
    if (job.name === "scan-scheduled-posts") {
      await enqueueDueTargets();
      return;
    }
    if (job.name === "publish-target") await publishTarget(job);
  },
  { connection, concurrency: 5 }
);

worker.on("failed", async (job, error) => {
  if (!job || job.name !== "publish-target" || (job.attemptsMade < (job.opts.attempts ?? 1) && !(error instanceof UnrecoverableError))) return;
  const target = await prisma.postTarget.findUnique({
    where: { id: job.data.targetId },
    include: { post: true }
  });
  if (!target || target.status === "PUBLISHED") return;
  const message = error.message.slice(0, 1000);
  await prisma.$transaction(async (tx) => {
    await tx.postTarget.update({ where: { id: target.id }, data: { status: "FAILED", lastError: message } });
    const remaining = await tx.postTarget.count({
      where: { postId: target.postId, status: { in: ["PENDING", "QUEUED", "PUBLISHING"] } }
    });
    const failures = await tx.postTarget.count({ where: { postId: target.postId, status: "FAILED" } });
    if (remaining === 0) {
      await tx.post.update({ where: { id: target.postId }, data: { status: failures ? "FAILED" : "PUBLISHED" } });
    }
    await tx.auditEvent.create({
      data: {
        workspaceId: target.post.workspaceId,
        action: "post.target_failed",
        targetType: "PostTarget",
        targetId: target.id,
        metadata: { error: message }
      }
    });
  });
});

worker.on("error", (error) => {
  process.stderr.write(`Publishing worker error: ${error.message}\n`);
});

await publishingQueue.add("scan-scheduled-posts", {}, {
  repeat: { every: 15_000 },
  jobId: "scan-scheduled-posts"
});

process.on("SIGTERM", async () => {
  await worker.close();
  await publishingQueue.close();
  await connection.quit();
  await prisma.$disconnect();
});
process.on("SIGINT", async () => {
  await worker.close();

  await publishingQueue.close();
  await connection.quit();
  await prisma.$disconnect();
});
