import { prisma } from "../prisma";

export function getPublishingTargetJobId(targetId: string) {
  return `publish-${targetId}`;
}

/** Atomically allow only one delivery to move a target from QUEUED to PUBLISHING. */
export async function claimQueuedPostTarget(targetId: string) {
  return prisma.postTarget.updateMany({
    where: { id: targetId, status: "QUEUED" },
    data: { status: "PUBLISHING", lastError: null }
  });
}
