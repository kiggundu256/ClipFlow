"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function mediaDirectory() {
  return resolve(process.env.CLIPFLOW_MEDIA_DIR || join(process.cwd(), "private-media"));
}

export async function uploadMedia(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/media?error=missing");
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) redirect("/media?error=type");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/media?error=size");

  const storageKey = `${randomUUID()}${extension}`;
  const directory = mediaDirectory();
  const fullPath = join(directory, storageKey);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(fullPath, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
    await prisma.mediaAsset.create({
      data: {
        workspaceId: membership.workspaceId,
        fileName: file.name.slice(0, 240),
        mimeType: file.type,
        sizeBytes: BigInt(file.size),
        storageKey
      }
    });
  } catch (error) {
    await unlink(fullPath).catch(() => undefined);
    throw error;
  }

  revalidatePath("/media");
  revalidatePath("/");
  redirect("/media?uploaded=1");
}

export async function createDraft(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const workspaceId = membership.workspaceId;
  const caption = String(formData.get("caption") ?? "").trim();
  const mediaAssetId = String(formData.get("mediaAssetId") ?? "").trim() || null;
  const accountIds = [...new Set(formData.getAll("socialAccountIds").map(String).filter(Boolean))];

  if (caption.length > 2200) redirect("/posts/new?error=caption");
  if (accountIds.length > 10) redirect("/posts/new?error=channels");

  if (accountIds.length) {
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: accountIds }, workspaceId },
      select: { id: true }
    });
    if (accounts.length !== accountIds.length) redirect("/posts/new?error=channels");
  }

  if (mediaAssetId) {
    const media = await prisma.mediaAsset.findFirst({ where: { id: mediaAssetId, workspaceId }, select: { id: true } });
    if (!media) redirect("/posts/new?error=media");
  }

  const post = await prisma.post.create({
    data: {
      workspaceId,
      caption,
      mediaAssetId,
      status: "DRAFT",
      targets: { create: accountIds.map((socialAccountId) => ({ socialAccountId })) }
    },
    select: { id: true }
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId,
      actorUserId: user.id,
      action: "post.draft_created",
      targetType: "Post",
      targetId: post.id,
      metadata: { targetCount: accountIds.length, hasMedia: Boolean(mediaAssetId) }
    }
  });

  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts?created=1");
}
