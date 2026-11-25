import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPublishingDefaultJobOptions,
  isPublishingFailureTerminal,
  PUBLISHING_BACKOFF_DELAY_MS,
  PUBLISHING_JOB_ATTEMPTS
} from "../../lib/publishing/retry-policy";

test("publishing jobs use bounded exponential retries", () => {
  const options = getPublishingDefaultJobOptions();
  assert.equal(options.attempts, 5);
  assert.equal(options.backoff.type, "exponential");
  assert.equal(options.backoff.delay, 30_000);
  assert.equal(PUBLISHING_JOB_ATTEMPTS, options.attempts);
  assert.equal(PUBLISHING_BACKOFF_DELAY_MS, options.backoff.delay);
});

test("transient publishing failures remain retryable until the final attempt", () => {
  assert.equal(isPublishingFailureTerminal(1, 5, false), false);
  assert.equal(isPublishingFailureTerminal(4, 5, false), false);
  assert.equal(isPublishingFailureTerminal(5, 5, false), true);
});

test("unrecoverable provider/configuration failures stop immediately", () => {
  assert.equal(isPublishingFailureTerminal(1, 5, true), true);
});
