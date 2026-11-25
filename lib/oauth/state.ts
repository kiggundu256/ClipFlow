import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function createOAuthStateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function getOAuthStateExpiry(now = new Date()) {
  return new Date(now.getTime() + OAUTH_STATE_TTL_MS);
}

export async function createOAuthState(userId: string, workspaceId: string, provider: string) {
  const state = createOAuthStateToken();
  await prisma.oAuthState.create({
    data: {
      stateHash: hashOAuthState(state),
      provider,
      userId,
      workspaceId,
      expiresAt: getOAuthStateExpiry()
    }
  });
  return state;
}

export async function consumeOAuthState(state: string, provider: string) {
  const stateHash = hashOAuthState(state);
  const pending = await prisma.oAuthState.findUnique({ where: { stateHash } });
  const now = new Date();

  if (!pending || pending.provider !== provider || pending.expiresAt <= now) {
    if (pending && pending.expiresAt <= now) {
      await prisma.oAuthState.deleteMany({ where: { id: pending.id } });
    }
    throw new Error("This connection request has expired. Please try again.");
  }

  // Delete with the expiry predicate to make state consumption single-use under concurrency.
  const consumed = await prisma.oAuthState.deleteMany({
    where: { id: pending.id, provider, expiresAt: { gt: now } }
  });
  if (consumed.count !== 1) {
    throw new Error("This connection request has already been used or has expired. Please try again.");
  }

  return pending;
}
