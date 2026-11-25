import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { claimQueuedPostTarget, getPublishingTargetJobId } from "../../lib/publishing/idempotency";

test("publishing target job IDs remain deterministic for duplicate enqueue attempts", () => {
  assert.equal(getPublishingTargetJobId("target-123"), "publish-target-123");
  assert.equal(getPublishingTargetJobId("target-123"), getPublishingTargetJobId("target-123"));
  assert.notEqual(getPublishingTargetJobId("target-123"), getPublishingTargetJobId("target-456"));
});

test("concurrent duplicate deliveries can claim a queued target only once", async () => {
  const suffix = randomUUID();
  const workspace = await prisma.workspace.create({
    data: { name: "Publishing idempotency", slug: `publishing-idempotency-${suffix}` }
  });
  try {
    const account = await prisma.socialAccount.create({
      data: { workspaceId: workspace.id, platform: "YOUTUBE", platformAccountId: `channel-${suffix}` }
    });
    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        caption: "Idempotency regression",
        status: "QUEUED",
        targets: { create: { socialAccountId: account.id, status: "QUEUED" } }
      },
      include: { targets: true }
    });
    const target = post.targets[0];
    assert.ok(target);

    const claims = await Promise.all([
      claimQueuedPostTarget(target.id),
      claimQueuedPostTarget(target.id),
      claimQueuedPostTarget(target.id)
    ]);
    assert.equal(claims.reduce((total, result) => total + result.count, 0), 1);
    assert.equal((await prisma.postTarget.findUnique({ where: { id: target.id } }))?.status, "PUBLISHING");

    assert.equal((await claimQueuedPostTarget(target.id)).count, 0);
    await prisma.postTarget.update({ where: { id: target.id }, data: { status: "PUBLISHED" } });
    assert.equal((await claimQueuedPostTarget(target.id)).count, 0);
    assert.equal((await prisma.postTarget.findUnique({ where: { id: target.id } }))?.status, "PUBLISHED");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
  }
});
