import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLOWED_MEDIA_TYPES, MAX_UPLOAD_BYTES, hasValidFileSignature } from "../../lib/media-validation";

test("allows only the explicitly supported image and video MIME types", () => {
  assert.deepEqual(Object.keys(ALLOWED_MEDIA_TYPES).sort(), [
    "image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"
  ]);
  assert.equal(ALLOWED_MEDIA_TYPES["application/javascript"], undefined);
  assert.equal(MAX_UPLOAD_BYTES, 100 * 1024 * 1024);
});

test("recognises valid JPEG, PNG, WebP, WebM and MP4 signatures", () => {
  assert.equal(hasValidFileSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(hasValidFileSignature("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidFileSignature("image/webp", Buffer.from("RIFFxxxxWEBP")), true);
  assert.equal(hasValidFileSignature("video/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), true);
  assert.equal(hasValidFileSignature("video/mp4", Buffer.from("0000ftypisom")), true);
  assert.equal(hasValidFileSignature("video/quicktime", Buffer.from("0000ftypqt  ")), true);
});

test("rejects mismatched, truncated and unsupported file signatures", () => {
  assert.equal(hasValidFileSignature("image/jpeg", Buffer.from("not a jpeg")), false);
  assert.equal(hasValidFileSignature("image/png", Buffer.from([0x89, 0x50, 0x4e])), false);
  assert.equal(hasValidFileSignature("image/webp", Buffer.from("RIFFxxxxNOPE")), false);
  assert.equal(hasValidFileSignature("video/webm", Buffer.from([0x1a, 0x45])), false);
  assert.equal(hasValidFileSignature("video/mp4", Buffer.from("not an mp4 file")), false);
  assert.equal(hasValidFileSignature("application/pdf", Buffer.from("%PDF-1.7")), false);
});
