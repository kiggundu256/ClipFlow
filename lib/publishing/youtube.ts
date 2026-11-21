import { UnrecoverableError } from "bullmq";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import type { PublishInput, PublishResult, PublishingAdapter } from "./adapters";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_RECOVERY_ATTEMPTS = 5;

type YouTubeVideoResponse = { id?: string; error?: { message?: string; errors?: Array<{ reason?: string }> } };

function uploadError(message: string): UnrecoverableError {
  return new UnrecoverableError(message.slice(0, 700));
}

function responseMessage(data: YouTubeVideoResponse, status: number) {
  const reason = data.error?.errors?.[0]?.reason;
  return reason ? `YouTube rejected the upload (${status}: ${reason}).` : data.error?.message?.slice(0, 500) ?? `YouTube upload failed (HTTP ${status}).`;
}

function getPrivacyStatus(): "private" | "unlisted" | "public" {
  const value = process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS ?? "unlisted";
  if (value !== "private" && value !== "unlisted" && value !== "public") {
    throw new Error("YOUTUBE_DEFAULT_PRIVACY_STATUS must be private, unlisted, or public.");
  }
  return value;
}

function buildMetadata(caption: string, fileName: string) {
  const cleanCaption = caption.trim().slice(0, 5_000);
  const firstLine = cleanCaption.split(/\r?\n/, 1)[0]?.trim();
  const fallbackTitle = path.parse(fileName).name.replace(/[_-]+/g, " ").trim();
  const title = (firstLine || fallbackTitle || "Untitled video").slice(0, 100);
  const tags = [...new Set([...cleanCaption.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)].map((match) => match[1]))].slice(0, 15);
  const tagBudget = 500;
  let used = 0;
  const boundedTags = tags.filter((tag) => {
    const next = tag.length + (used ? 1 : 0);
    if (used + next > tagBudget) return false;
    used += next;
    return true;
  });

  return {
    snippet: {
      title,
      description: cleanCaption,
      categoryId: process.env.YOUTUBE_CATEGORY_ID?.match(/^\d{1,3}$/) ? process.env.YOUTUBE_CATEGORY_ID : "22",
      ...(boundedTags.length ? { tags: boundedTags } : {})
    },
    status: { privacyStatus: getPrivacyStatus() }
  };
}

async function readApiError(response: Response) {
  let data: YouTubeVideoResponse = {};
  try { data = await response.json() as YouTubeVideoResponse; } catch { /* provider returned no JSON */ }
  const message = responseMessage(data, response.status);
  if (response.status === 429 || response.status >= 500) throw new Error(message);
  throw uploadError(message);
}

function uploadedOffset(response: Response) {
  const range = response.headers.get("range");
  if (!range) return 0;
  const match = range.match(/bytes=0-(\d+)/i);
  return match ? Number(match[1]) + 1 : 0;
}

async function startResumableUpload(input: {
  accessToken: string;
  metadata: ReturnType<typeof buildMetadata>;
  mimeType: string;
  size: number;
}) {
  const url = new URL(UPLOAD_URL);
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("part", "snippet,status");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.mimeType,
      "X-Upload-Content-Length": String(input.size)
    },
    body: JSON.stringify(input.metadata),
    cache: "no-store"
  });
  if (!response.ok) await readApiError(response);
  const sessionUrl = response.headers.get("location");
  if (!sessionUrl || !sessionUrl.startsWith("https://")) {
    throw new Error("YouTube did not return a valid resumable upload session.");
  }
  return sessionUrl;
}

async function queryUploadStatus(sessionUrl: string, accessToken: string, size: number) {
  const response = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": "0",
      "Content-Range": `bytes */${size}`
    },
    body: new Uint8Array(),
    cache: "no-store"
  });
  if (response.status === 308) return { offset: uploadedOffset(response), videoId: null };
  if (response.status === 200 || response.status === 201) {
    const data = await response.json() as YouTubeVideoResponse;
    if (data.id) return { offset: size, videoId: data.id };
    throw uploadError("YouTube completed the upload but did not return a video ID. Check the channel before retrying.");
  }
  if (response.status === 404 || response.status === 410) {
    throw uploadError("The YouTube upload session expired. The result may be unknown; check the channel before retrying.");
  }
  await readApiError(response);
  throw new Error("Unable to determine YouTube upload progress.");
}

async function uploadChunks(sessionUrl: string, accessToken: string, mediaPath: string, size: number): Promise<string> {
  const file = await open(mediaPath, "r");
  let offset = 0;
  let recoveryAttempts = 0;
  try {
    while (offset < size) {
      const length = Math.min(CHUNK_SIZE, size - offset);
      const chunk = Buffer.allocUnsafe(length);
      const read = await file.read(chunk, 0, length, offset);
      if (read.bytesRead !== length) throw new Error("The video file changed or could not be read during upload.");

      let response: Response;
      try {
        response = await fetch(sessionUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(length),
            "Content-Range": `bytes ${offset}-${offset + length - 1}/${size}`
          },
          body: chunk,
          cache: "no-store"
        });
      } catch {
        recoveryAttempts += 1;
        if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
          throw uploadError("The YouTube upload connection was interrupted repeatedly. Check the channel before retrying to avoid a duplicate video.");
        }
        try {
          const status = await queryUploadStatus(sessionUrl, accessToken, size);
          if (status.videoId) return status.videoId;
          offset = status.offset;
          continue;
        } catch (statusError) {
          if (statusError instanceof UnrecoverableError) throw statusError;
          if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            throw uploadError("YouTube upload progress could not be confirmed. Check the channel before retrying to avoid a duplicate video.");
          }
          continue;
        }
      }

      if (response.status === 308) {
        const nextOffset = uploadedOffset(response);
        if (nextOffset <= offset && nextOffset < size) {
          recoveryAttempts += 1;
          if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
            throw uploadError("YouTube did not advance the upload. Check the channel before retrying.");
          }
          const status = await queryUploadStatus(sessionUrl, accessToken, size);
          if (status.videoId) return status.videoId;
          offset = status.offset;
        } else {
          offset = nextOffset;
          recoveryAttempts = 0;
        }
        continue;
      }

      if (response.status === 200 || response.status === 201) {
        const data = await response.json() as YouTubeVideoResponse;
        if (data.id) return data.id;
        throw uploadError("YouTube accepted the upload but returned no video ID. Check the channel before retrying.");
      }

      if (response.status >= 500 || response.status === 429) {
        recoveryAttempts += 1;
        if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
          throw uploadError("YouTube's upload result could not be confirmed after repeated server errors. Check the channel before retrying.");
        }
        const status = await queryUploadStatus(sessionUrl, accessToken, size);
        if (status.videoId) return status.videoId;
        offset = status.offset;
        continue;
      }

      await readApiError(response);
    }
  } finally {
    await file.close();
  }
  throw uploadError("The YouTube upload ended without a confirmed video ID. Check the channel before retrying.");
}

export const youtubePublishingAdapter: PublishingAdapter = {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.scopes.includes("https://www.googleapis.com/auth/youtube.upload")) {
      throw uploadError("This YouTube connection does not have upload permission. Disconnect and reconnect the channel, then approve YouTube upload access.");
    }
    if (!input.mediaPath || !input.mimeType || !input.fileName) {
      throw uploadError("YouTube publishing requires a video file.");
    }
    if (!input.mimeType.startsWith("video/")) {
      throw uploadError("YouTube accepts video files only. Select an MP4, MOV, or WebM video.");
    }

    const details = await stat(input.mediaPath);
    if (!details.isFile() || details.size === 0) throw uploadError("The selected video file is empty or unavailable.");

    const metadata = buildMetadata(input.caption, input.fileName);
    const sessionUrl = await startResumableUpload({
      accessToken: input.accessToken,
      metadata,
      mimeType: input.mimeType,
      size: details.size
    });
    const platformPostId = await uploadChunks(sessionUrl, input.accessToken, input.mediaPath, details.size);
    return { platformPostId };
  }
};
