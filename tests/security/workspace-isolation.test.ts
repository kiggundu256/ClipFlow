import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import {
  findWorkspaceMediaAsset,
  findWorkspaceSocialAccounts,
  scheduleWorkspaceDraft
} from "../../lib/workspace-access";

test("workspace-scoped media, channel and scheduling operations reject another workspace's records", async () => {
  const suffix = randomUUID();
  const workspaceA = await prisma.workspace.create({
    data: { name: "Isolation A", slug: `isolation-a-${suffix}` }
  });
  const workspaceB = await prisma.workspace.create({
    data: { name: "Isolation B", slug: `isolation-b-${suffix}` }
  });

  try {
    const [mediaA, mediaB] = await Promise.all([
      prisma.mediaAsset.create({
        data: { workspaceId: workspaceA.id, fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 3n, storageKey: `${suffix}-a.jpg` }
      }),
      prisma.mediaAsset.create({
        data: { workspaceId: workspaceB.id, fileName: "b.jpg", mimeType: "image/jpeg", sizeBytes: 3n, storageKey: `${suffix}-b.jpg` }
      })
    ]);

    const [accountA, accountB] = await Promise.all([
      prisma.socialAccount.create({
        data: { workspaceId: workspaceA.id, platform: "YOUTUBE", platformAccountId: `${suffix}-a` }
      }),
      prisma.socialAccount.create({
        data: { workspaceId: workspaceB.id, platform: "YOUTUBE", platformAccountId: `${suffix}-b` }
      })
    ]);

    const foreignDraft = await prisma.post.create({
      data: { workspaceId: workspaceB.id, caption: "Private workspace B draft" }
    });

    assert.equal((await findWorkspaceMediaAsset(workspaceA.id, mediaA.id))?.id, mediaA.id);
    assert.equal(await findWorkspaceMediaAsset(workspaceA.id, mediaB.id), null);

    const visibleAccounts = await findWorkspaceSocialAccounts(workspaceA.id, [accountA.id, accountB.id]);
    assert.deepEqual(visibleAccounts.map((account) => account.id), [accountA.id]);

    const result = await prisma.$transaction((tx) =>
      scheduleWorkspaceDraft(tx, workspaceA.id, foreignDraft.id, new Date(Date.now() + 86_400_000))
    );
    assert.equal(result.count, 0);

    const unchangedDraft = await prisma.post.findUnique({ where: { id: foreignDraft.id } });
    assert.equal(unchangedDraft?.status, "DRAFT");
    assert.equal(unchangedDraft?.scheduledAt, null);
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: [workspaceA.id, workspaceB.id] } } });
  }
});
