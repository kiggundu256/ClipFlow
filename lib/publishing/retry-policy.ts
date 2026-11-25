export const PUBLISHING_JOB_ATTEMPTS = 5;
export const PUBLISHING_BACKOFF_DELAY_MS = 30_000;

export function getPublishingDefaultJobOptions() {
  return {
    attempts: PUBLISHING_JOB_ATTEMPTS,
    backoff: { type: "exponential" as const, delay: PUBLISHING_BACKOFF_DELAY_MS },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
    removeOnFail: { age: 30 * 24 * 60 * 60 }
  };
}

export function isPublishingFailureTerminal(
  attemptsMade: number,
  configuredAttempts: number,
  unrecoverable: boolean
) {
  return unrecoverable || attemptsMade >= configuredAttempts;
}
