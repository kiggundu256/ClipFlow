CREATE TYPE "PostTargetStatus" AS ENUM ('PENDING', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELED');

ALTER TABLE "PostTarget"
  ADD COLUMN "status" "PostTargetStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "PostTarget_status_createdAt_idx" ON "PostTarget"("status", "createdAt");

ALTER TABLE "PublishingAttempt" ADD COLUMN "postTargetId" TEXT;
CREATE INDEX "PublishingAttempt_postTargetId_startedAt_idx"
  ON "PublishingAttempt"("postTargetId", "startedAt");
ALTER TABLE "PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_postTargetId_fkey"
  FOREIGN KEY ("postTargetId") REFERENCES "PostTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PostTarget_status_updatedAt_idx" ON "PostTarget"("status", "updatedAt");
