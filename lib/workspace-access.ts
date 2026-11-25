import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function findWorkspaceMediaAsset(workspaceId: string, assetId: string) {
  return prisma.mediaAsset.findFirst({
    where: { id: assetId, workspaceId },
    select: { id: true, storageKey: true, mimeType: true, fileName: true }
  });
}

export function findWorkspaceSocialAccounts(workspaceId: string, accountIds: string[]) {
  if (accountIds.length === 0) return Promise.resolve([]);
  return prisma.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId },
    select: { id: true }
  });
}

export function scheduleWorkspaceDraft(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  postId: string,
  scheduledAt: Date
) {
  return tx.post.updateMany({
    where: { id: postId, workspaceId, status: "DRAFT", scheduledAt: null },
    data: { scheduledAt, status: "SCHEDULED" }
  });
}
