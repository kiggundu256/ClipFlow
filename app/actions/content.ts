"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES, hasValidFileSignature } from "@/lib/media-validation";
import { findWorkspaceMediaAsset, findWorkspaceSocialAccounts, scheduleWorkspaceDraft } from "@/lib/workspace-access";

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
  const extension = ALLOWED_MEDIA_TYPES[file.type];
  if (!extension) redirect("/media?error=type");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/media?error=size");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidFileSignature(file.type, bytes)) redirect("/media?error=type");

  const storageKey = `${randomUUID()}${extension}`;
  const directory = mediaDirectory();
  const fullPath = join(directory, storageKey);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(fullPath, bytes, { flag: "wx", mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          workspaceId: membership.workspaceId,
          fileName: file.name.slice(0, 240),
          mimeType: file.type,
          sizeBytes: BigInt(file.size),
          storageKey
        },
        select: { id: true }
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: membership.workspaceId,
          actorUserId: user.id,
          action: "media.uploaded",
          targetType: "MediaAsset",
          targetId: asset.id,
          metadata: { mimeType: file.type, sizeBytes: file.size }
        }
      });
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
    const accounts = await findWorkspaceSocialAccounts(workspaceId, accountIds);
    if (accounts.length !== accountIds.length) redirect("/posts/new?error=channels");
  }

  if (mediaAssetId) {
    const media = await findWorkspaceMediaAsset(workspaceId, mediaAssetId);
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


export async function scheduleDraft(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = user.memberships[0];
  if (!membership) redirect("/register");

  const postId = String(formData.get("postId") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = new Date(scheduledAtRaw);
  if (!postId || !scheduledAtRaw || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 60_000) {
    redirect("/calendar?error=time");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await scheduleWorkspaceDraft(tx, membership.workspaceId, postId, scheduledAt);
    if (result.count !== 1) return false;
    await tx.auditEvent.create({
      data: {
        workspaceId: membership.workspaceId,
        actorUserId: user.id,
        action: "post.scheduled",
        targetType: "Post",
        targetId: postId,
        metadata: { scheduledAt: scheduledAt.toISOString(), queueEnabled: false }
      }
    });
    return true;
  });
  if (!updated) redirect("/calendar?error=post");

  revalidatePath("/calendar");
  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/calendar?scheduled=1");
}
