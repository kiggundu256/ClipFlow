import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import {
  consumeOAuthState,
  createOAuthState,
  createOAuthStateToken,
  hashOAuthState
} from "../../lib/oauth/state";

async function createIdentityFixture() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: { email: `oauth-${suffix}@example.test`, name: "OAuth Test" }
  });
  const workspace = await prisma.workspace.create({
    data: { name: "OAuth Test Workspace", slug: `oauth-test-${suffix}` }
  });
  return { user, workspace };
}

test("OAuth state is provider-bound, single-use and cannot be replayed concurrently", async () => {
  const { user, workspace } = await createIdentityFixture();
  try {
    const state = await createOAuthState(user.id, workspace.id, "YOUTUBE");
    const results = await Promise.allSettled([
      consumeOAuthState(state, "YOUTUBE"),
      consumeOAuthState(state, "YOUTUBE")
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(
      await prisma.oAuthState.count({ where: { stateHash: hashOAuthState(state) } }),
      0
    );
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("OAuth state rejects a different provider and removes expired state", async () => {
  const { user, workspace } = await createIdentityFixture();
  try {
    const state = await createOAuthState(user.id, workspace.id, "INSTAGRAM");

    await assert.rejects(
      consumeOAuthState(state, "YOUTUBE"),
      /connection request has expired/
    );
    assert.equal(
      await prisma.oAuthState.count({ where: { stateHash: hashOAuthState(state) } }),
      1
    );
    const pending = await consumeOAuthState(state, "INSTAGRAM");
    assert.equal(pending.workspaceId, workspace.id);
    assert.equal(pending.userId, user.id);

    const expiredState = createOAuthStateToken();
    await prisma.oAuthState.create({
      data: {
        stateHash: hashOAuthState(expiredState),
        provider: "YOUTUBE",
        userId: user.id,
        workspaceId: workspace.id,
        expiresAt: new Date(Date.now() - 1)
      }
    });

    await assert.rejects(
      consumeOAuthState(expiredState, "YOUTUBE"),
      /connection request has expired/
    );
    assert.equal(
      await prisma.oAuthState.count({ where: { stateHash: hashOAuthState(expiredState) } }),
      0
    );
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
