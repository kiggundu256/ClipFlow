import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../../lib/password";

test("password hashes are salted and do not expose the original password", () => {
  const first = hashPassword("ClipFlow-test-password-2026");
  const second = hashPassword("ClipFlow-test-password-2026");
  assert.notEqual(first, second);
  assert.equal(first.includes("ClipFlow-test-password-2026"), false);
  assert.match(first, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test("password verification accepts the correct password and rejects an incorrect one", () => {
  const stored = hashPassword("Correct-Horse-Battery-2026");
  assert.equal(verifyPassword("Correct-Horse-Battery-2026", stored), true);
  assert.equal(verifyPassword("Wrong-password", stored), false);
});

test("password verification safely rejects malformed stored hashes", () => {
  assert.equal(verifyPassword("password", ""), false);
  assert.equal(verifyPassword("password", "missing-separator"), false);
  assert.equal(verifyPassword("password", "salt:not-hex"), false);
  assert.equal(verifyPassword("password", "salt:abc"), false);
});
