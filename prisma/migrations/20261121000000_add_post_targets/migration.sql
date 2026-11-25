CREATE TABLE "PostTarget" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostTarget_postId_socialAccountId_key" ON "PostTarget"("postId", "socialAccountId");
CREATE INDEX "PostTarget_socialAccountId_idx" ON "PostTarget"("socialAccountId");

ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
