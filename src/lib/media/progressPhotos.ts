import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAttachments, photos, progressEntries } from "@/db/schema";

export const PROGRESS_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PROGRESS_PHOTO_BYTES = 12 * 1024 * 1024;

export function progressPhotoKey(userId: string, photoId: string) {
  return `progress/${userId}/${photoId}.webp`;
}

export async function normalizeProgressPhoto(bytes: Uint8Array) {
  let metadata;
  try { metadata = await sharp(bytes, { failOn: "error", animated: true }).metadata(); }
  catch { throw new Error("The file is not a valid image"); }
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Only JPEG, PNG, and WebP images are supported");
  if ((metadata.pages ?? 1) > 1) throw new Error("Animated images are not supported");
  const result = await sharp(bytes, { failOn: "error" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: result.data, width: result.info.width, height: result.info.height };
}

export async function findOwnedProgressPhoto(photoId: string, userId: string) {
  const [row] = await db
    .select({ id: photos.id, storageKey: photos.storageKey, width: photos.width, height: photos.height, entryId: progressEntries.id, entryDate: progressEntries.entryDate })
    .from(photos)
    .innerJoin(mediaAttachments, and(eq(mediaAttachments.photoId, photos.id), eq(mediaAttachments.subjectType, "progress_entry")))
    .innerJoin(progressEntries, eq(progressEntries.id, mediaAttachments.subjectId))
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId), eq(progressEntries.userId, userId), eq(photos.purpose, "progress"), eq(photos.isPrivate, true)))
    .limit(1);
  return row ?? null;
}
