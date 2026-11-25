import { prisma } from "../prisma";

export const INTERRUPTED_PUBLISHING_MESSAGE =
  "Publishing was interrupted and the platform result is unknown. Check the destination account before retrying.";

/**
 * Marks a stale in-flight target as failed for manual reconciliation.
 * It deliberately does not enqueue a retry because the provider may already
 * have accepted the request before the worker stopped.
 */
export async function recoverInterruptedTarget(
  targetId: string,
  cutoff: Date,
  now = new Date()
): Promise<boolean> {
  const target = await prisma.postTarget.findUnique({
    where: { id: targetId },
    select: { id: true, postId: true, post: { select: { workspaceId: true } } }
  });
  if (!target) return false;

  return prisma.$transaction(async (tx) => {
    const changed = await tx.postTarget.updateMany({
      where: { id: target.id, status: "PUBLISHING", updatedAt: { lt: cutoff } },
      data: { status: "FAILED", lastError: INTERRUPTED_PUBLISHING_MESSAGE }
    });
    if (changed.count !== 1) return false;

    await tx.publishingAttempt.updateMany({
      where: { postTargetId: target.id, status: "PROCESSING" },
      data: {
        status: "FAILED",
        errorCode: "WORKER_INTERRUPTED",
        errorMessage: INTERRUPTED_PUBLISHING_MESSAGE,
        finishedAt: now
      }
    });

    const remaining = await tx.postTarget.count({
      where: { postId: target.postId, status: { in: ["PENDING", "QUEUED", "PUBLISHING"] } }
    });
    if (remaining === 0) {
      await tx.post.update({
        where: { id: target.postId },
        data: { status: "FAILED", lastError: INTERRUPTED_PUBLISHING_MESSAGE }
      });
    }

    await tx.auditEvent.create({
      data: {
        workspaceId: target.post.workspaceId,
        action: "post.target_interrupted",
        targetType: "PostTarget",
        targetId: target.id,
        metadata: { code: "WORKER_INTERRUPTED" }
      }
    });
    return true;
  });
}
