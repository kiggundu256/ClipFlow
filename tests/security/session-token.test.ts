import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionToken, getSessionExpiry, hashSessionToken } from "../../lib/session-token";

test("session tokens are cryptographically random opaque values", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(first.includes("clipflow"), false);
});

test("session token hashes are deterministic and do not reveal the token", () => {
  const token = createSessionToken();
  const hash = hashSessionToken(token);
  assert.equal(hashSessionToken(token), hash);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.notEqual(hashSessionToken(createSessionToken()), hash);
});

test("session expiry is exactly 30 days after the supplied time", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(getSessionExpiry(now).toISOString(), "2026-01-31T00:00:00.000Z");
});
