import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";

process.env.NEXT_PHASE = "phase-production-build";

test("local media storage implements put/get/exists/delete/list", async () => {
  const { LocalMediaStorage } = await import("../../src/lib/media/storage");
  const root = await mkdtemp(path.join(tmpdir(), "macro-media-"));
  try {
    const storage = new LocalMediaStorage(root);
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.put("progress/user/photo.webp", bytes, "image/webp");
    assert.equal(await storage.exists("progress/user/photo.webp"), true);
    assert.deepEqual(await storage.get("progress/user/photo.webp"), Buffer.from(bytes));
    assert.deepEqual(await storage.list("progress/"), ["progress/user/photo.webp"]);
    await storage.delete("progress/user/photo.webp");
    assert.equal(await storage.exists("progress/user/photo.webp"), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("normalization resizes, rotates, strips metadata, and emits WebP", async () => {
  const { normalizeProgressPhoto, progressPhotoKey } = await import("../../src/lib/media/progressPhotos");
  const source = await sharp({ create: { width: 2200, height: 1000, channels: 3, background: "#22c55e" } })
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "private metadata" } } }).jpeg().toBuffer();
  const result = await normalizeProgressPhoto(source);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(Math.max(result.width, result.height), 1600);
  assert.equal(metadata.exif, undefined);
  assert.equal(result.width, 727);
  assert.equal(result.height, 1600);
  assert.equal(progressPhotoKey("user-id", "photo-id"), "progress/user-id/photo-id.webp");
});

test("normalization rejects invalid image bytes", async () => {
  const { normalizeProgressPhoto } = await import("../../src/lib/media/progressPhotos");
  await assert.rejects(() => normalizeProgressPhoto(new Uint8Array([1, 2, 3])), /valid image/);
});
