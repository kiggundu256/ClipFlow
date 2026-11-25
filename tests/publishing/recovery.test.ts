import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import {
  INTERRUPTED_PUBLISHING_MESSAGE,
  recoverInterruptedTarget
} from "../../lib/publishing/recovery";

test("stale publishing targets are failed for reconciliation with their active attempt and audit event", async () => {
  const suffix = randomUUID();
  const workspace = await prisma.workspace.create({
    data: { name: "Interrupted publishing", slug: `interrupted-publishing-${suffix}` }
  });

  try {
    const account = await prisma.socialAccount.create({
      data: { workspaceId: workspace.id, platform: "YOUTUBE", platformAccountId: `interrupted-${suffix}` }
    });
    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        caption: "Interrupted upload",
        status: "PUBLISHING",
        targets: { create: { socialAccountId: account.id, status: "PUBLISHING" } }
      },
      include: { targets: true }
    });
    const target = post.targets[0];
    assert.ok(target);

    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const recoveredAt = new Date();
    await prisma.postTarget.update({ where: { id: target.id }, data: { updatedAt: staleAt } });
    const attempt = await prisma.publishingAttempt.create({
      data: { postId: post.id, postTargetId: target.id, status: "PROCESSING" }
    });

    assert.equal(await recoverInterruptedTarget(target.id, cutoff, recoveredAt), true);

    const recoveredTarget = await prisma.postTarget.findUnique({ where: { id: target.id } });
    assert.equal(recoveredTarget?.status, "FAILED");
    assert.equal(recoveredTarget?.lastError, INTERRUPTED_PUBLISHING_MESSAGE);

    const recoveredAttempt = await prisma.publishingAttempt.findUnique({ where: { id: attempt.id } });
    assert.equal(recoveredAttempt?.status, "FAILED");
    assert.equal(recoveredAttempt?.errorCode, "WORKER_INTERRUPTED");
    assert.equal(recoveredAttempt?.errorMessage, INTERRUPTED_PUBLISHING_MESSAGE);
    assert.equal(recoveredAttempt?.finishedAt?.getTime(), recoveredAt.getTime());

    const failedPost = await prisma.post.findUnique({ where: { id: post.id } });
    assert.equal(failedPost?.status, "FAILED");
    assert.equal(failedPost?.lastError, INTERRUPTED_PUBLISHING_MESSAGE);

    const event = await prisma.auditEvent.findFirst({
      where: { workspaceId: workspace.id, action: "post.target_interrupted", targetId: target.id }
    });
    assert.ok(event);
    assert.deepEqual(event.metadata, { code: "WORKER_INTERRUPTED" });
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
  }
});

test("recovery leaves fresh targets untouched and preserves a post with another active target", async () => {
  const suffix = randomUUID();
  const workspace = await prisma.workspace.create({
    data: { name: "Recovery guards", slug: `recovery-guards-${suffix}` }
  });

  try {
    const [accountA, accountB] = await Promise.all([
      prisma.socialAccount.create({
        data: { workspaceId: workspace.id, platform: "YOUTUBE", platformAccountId: `guard-a-${suffix}` }
      }),
      prisma.socialAccount.create({
        data: { workspaceId: workspace.id, platform: "INSTAGRAM", platformAccountId: `guard-b-${suffix}` }
      })
    ]);
    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        caption: "One target interrupted, one still queued",
        status: "PUBLISHING",
        targets: {
          create: [
            { socialAccountId: accountA.id, status: "PUBLISHING" },
            { socialAccountId: accountB.id, status: "QUEUED" }
          ]
        }
      },
      include: { targets: true }
    });
    const staleTarget = post.targets.find((target) => target.socialAccountId === accountA.id);
    const queuedTarget = post.targets.find((target) => target.socialAccountId === accountB.id);
    assert.ok(staleTarget);
    assert.ok(queuedTarget);

    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.postTarget.update({
      where: { id: staleTarget.id },
      data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    });
    assert.equal(await recoverInterruptedTarget(staleTarget.id, cutoff), true);
    assert.equal((await prisma.post.findUnique({ where: { id: post.id } }))?.status, "PUBLISHING");
    assert.equal((await prisma.postTarget.findUnique({ where: { id: queuedTarget.id } }))?.status, "QUEUED");

    const freshPost = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        caption: "Fresh publishing target",
        status: "PUBLISHING",
        targets: { create: { socialAccountId: accountA.id, status: "PUBLISHING" } }
      },
      include: { targets: true }
    });
    const freshTarget = freshPost.targets[0];
    assert.ok(freshTarget);
    assert.equal(await recoverInterruptedTarget(freshTarget.id, cutoff), false);
    assert.equal((await prisma.postTarget.findUnique({ where: { id: freshTarget.id } }))?.status, "PUBLISHING");
    assert.equal((await prisma.post.findUnique({ where: { id: freshPost.id } }))?.status, "PUBLISHING");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
  }
});
