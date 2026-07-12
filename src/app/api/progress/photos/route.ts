import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { mediaAttachments, photos, progressEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getMediaStorage } from "@/lib/media/storage";
import { MAX_PROGRESS_PHOTO_BYTES, normalizeProgressPhoto, PROGRESS_PHOTO_TYPES, progressPhotoKey } from "@/lib/media/progressPhotos";

export const runtime = "nodejs";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 }); }
  const entryDate = String(form.get("entryDate") ?? "");
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (!validDate(entryDate)) return NextResponse.json({ error: "Enter a valid progress date" }, { status: 400 });
  if (files.length < 1 || files.length > 4) return NextResponse.json({ error: "Choose between 1 and 4 photos" }, { status: 400 });
  for (const file of files) {
    if (!PROGRESS_PHOTO_TYPES.has(file.type)) return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported" }, { status: 415 });
    if (file.size > MAX_PROGRESS_PHOTO_BYTES) return NextResponse.json({ error: `${file.name || "A photo"} is larger than 12 MB` }, { status: 413 });
  }

  const storage = getMediaStorage();
  const created: Array<{ id: string; entryDate: string; mimeType: "image/webp"; width: number; height: number }> = [];
  for (const file of files) {
    const id = randomUUID();
    const key = progressPhotoKey(user.id, id);
    try {
      const normalized = await normalizeProgressPhoto(new Uint8Array(await file.arrayBuffer()));
      await storage.put(key, normalized.bytes, "image/webp");
      try {
        await db.transaction(async (tx) => {
          const [existing] = await tx.select({ id: progressEntries.id }).from(progressEntries)
            .where(and(eq(progressEntries.userId, user.id), eq(progressEntries.entryDate, entryDate))).limit(1);
          const entryId = existing?.id ?? (await tx.insert(progressEntries).values({ userId: user.id, entryDate }).returning({ id: progressEntries.id }))[0].id;
          await tx.insert(photos).values({ id, userId: user.id, storageKey: key, mimeType: "image/webp", purpose: "progress", width: normalized.width, height: normalized.height, isPrivate: true });
          await tx.insert(mediaAttachments).values({ photoId: id, subjectType: "progress_entry", subjectId: entryId });
        });
      } catch (error) {
        await storage.delete(key).catch(() => undefined);
        throw error;
      }
      created.push({ id, entryDate, mimeType: "image/webp", width: normalized.width, height: normalized.height });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed", photos: created }, { status: 400 });
    }
  }
  revalidatePath("/progress");
  revalidatePath("/progress/photos");
  return NextResponse.json({ photos: created }, { status: 201 });
}
