import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { youtubePublishingAdapter } from "../../lib/publishing/youtube";

const uploadScope = "https://www.googleapis.com/auth/youtube.upload";
const channelId = "channel-123";
const originalFetch = globalThis.fetch;
const originalPrivacy = process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS;
const originalCategory = process.env.YOUTUBE_CATEGORY_ID;

let directory = "";
let videoPath = "";

function input(overrides: Partial<Parameters<typeof youtubePublishingAdapter.publish>[0]> = {}) {
  return {
    platformAccountId: channelId,
    accessToken: "test-access-token",
    scopes: [uploadScope],
    caption: "A new creator video\nBehind the scenes #CreatorLife #Uganda",
    mediaPath: videoPath,
    mimeType: "video/mp4",
    fileName: "creator-video.mp4",
    ...overrides
  };
}

function completedUpload() {
  return new Response(JSON.stringify({
    id: "youtube-video-456",
    snippet: { channelId }
  }), {
    status: 201,
    headers: { "content-type": "application/json" }
  });
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "clipflow-youtube-test-"));
  videoPath = path.join(directory, "creator-video.mp4");
  await writeFile(videoPath, Buffer.from("abcdef"));
  delete process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS;
  delete process.env.YOUTUBE_CATEGORY_ID;
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalPrivacy === undefined) delete process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS;
  else process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS = originalPrivacy;
  if (originalCategory === undefined) delete process.env.YOUTUBE_CATEGORY_ID;
  else process.env.YOUTUBE_CATEGORY_ID = originalCategory;
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("uploads a video with bounded metadata and confirms the destination channel", async () => {
  let metadata: Record<string, unknown> | undefined;
  let uploadRange = "";

  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      metadata = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(null, {
        status: 200,
        headers: { location: "https://upload.youtube.test/session" }
      });
    }
    uploadRange = new Headers(init?.headers).get("content-range") ?? "";
    return completedUpload();
  }) as typeof fetch;

  const result = await youtubePublishingAdapter.publish(input());

  assert.equal(result.platformPostId, "youtube-video-456");
  assert.equal(uploadRange, "bytes 0-5/6");
  assert.deepEqual(metadata, {
    snippet: {
      title: "A new creator video",
      description: "A new creator video\nBehind the scenes #CreatorLife #Uganda",
      categoryId: "22",
      tags: ["CreatorLife", "Uganda"]
    },
    status: { privacyStatus: "unlisted" }
  });
});

test("reconciles an interrupted chunk before resuming from the confirmed byte offset", async () => {
  const uploadRanges: string[] = [];
  let chunkAttempts = 0;

  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response(null, {
        status: 200,
        headers: { location: "https://upload.youtube.test/session" }
      });
    }

    const range = new Headers(init?.headers).get("content-range") ?? "";
    uploadRanges.push(range);

    if (range === "bytes 0-5/6" && chunkAttempts++ === 0) {
      throw new TypeError("simulated connection interruption");
    }
    if (range === "bytes */6") {
      return new Response(null, {
        status: 308,
        headers: { range: "bytes=0-2" }
      });
    }
    return completedUpload();
  }) as typeof fetch;

  const result = await youtubePublishingAdapter.publish(input());

  assert.equal(result.platformPostId, "youtube-video-456");
  assert.deepEqual(uploadRanges, ["bytes 0-5/6", "bytes */6", "bytes 3-5/6"]);
});

test("rejects a connected channel without the YouTube upload OAuth scope before making a request", async () => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return new Response(null, { status: 500 });
  }) as typeof fetch;

  await assert.rejects(
    youtubePublishingAdapter.publish(input({ scopes: ["https://www.googleapis.com/auth/youtube.readonly"] })),
    /does not have upload permission/
  );
  assert.equal(requestCount, 0);
});

test("rejects non-video media before opening an upload session", async () => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return new Response(null, { status: 500 });
  }) as typeof fetch;

  await assert.rejects(
    youtubePublishingAdapter.publish(input({ mimeType: "image/jpeg" })),
    /video files only/
  );
  assert.equal(requestCount, 0);
});
