import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { mediaAttachments, photos, progressEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { findOwnedProgressPhoto } from "@/lib/media/progressPhotos";
import { getMediaStorage, isSafeStorageKey } from "@/lib/media/storage";

export const runtime = "nodejs";
const idSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = idSchema.safeParse((await context.params).photoId);
  if (!parsed.success) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const photo = await findOwnedProgressPhoto(parsed.data, user.id);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  try {
    const bytes = await getMediaStorage().get(photo.storageKey);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="progress-${photo.entryDate}-${photo.id}.webp"` } : {}),
    }});
  } catch {
    return NextResponse.json({ error: "Photo object not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = idSchema.safeParse((await context.params).photoId);
  if (!parsed.success) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const photo = await findOwnedProgressPhoto(parsed.data, user.id);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  if (isSafeStorageKey(photo.storageKey)) await getMediaStorage().delete(photo.storageKey);
  await db.transaction(async (tx) => {
    await tx.delete(mediaAttachments).where(and(eq(mediaAttachments.photoId, photo.id), eq(mediaAttachments.subjectType, "progress_entry"), eq(mediaAttachments.subjectId, photo.entryId)));
    await tx.delete(photos).where(and(eq(photos.id, photo.id), eq(photos.userId, user.id)));
    const [entry] = await tx.select().from(progressEntries).where(and(eq(progressEntries.id, photo.entryId), eq(progressEntries.userId, user.id))).limit(1);
    if (entry && entry.weightKg == null && entry.bodyFatPct == null && entry.waistCm == null && entry.chestCm == null && entry.hipsCm == null && entry.armsCm == null && entry.note == null) {
      const [remaining] = await tx.select({ id: mediaAttachments.id }).from(mediaAttachments).where(and(eq(mediaAttachments.subjectType, "progress_entry"), eq(mediaAttachments.subjectId, entry.id))).limit(1);
      if (!remaining) await tx.delete(progressEntries).where(and(eq(progressEntries.id, entry.id), eq(progressEntries.userId, user.id), isNull(progressEntries.weightKg)));
    }
  });
  revalidatePath("/progress");
  revalidatePath("/progress/photos");
  return new Response(null, { status: 204 });
}
