import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { mediaAttachments, photos } from "../src/db/schema";
import { getMediaStorage } from "../src/lib/media/storage";

async function main() {
  const rows = await db.select({ id: photos.id, key: photos.storageKey, mimeType: photos.mimeType, attachmentId: mediaAttachments.id })
    .from(photos).leftJoin(mediaAttachments, and(eq(mediaAttachments.photoId, photos.id), eq(mediaAttachments.subjectType, "progress_entry")))
    .where(eq(photos.purpose, "progress"));
  const storage = getMediaStorage();
  const objectKeys = new Set(await storage.list("progress/"));
  const databaseKeys = new Set(rows.map((row) => row.key));
  const missingObjects = rows.filter((row) => !objectKeys.has(row.key));
  const orphanObjects = [...objectKeys].filter((key) => !databaseKeys.has(key));
  const legacyMetadata = rows.filter((row) => row.mimeType !== "image/webp" || !/^progress\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/i.test(row.key) || !row.attachmentId);
  console.log(JSON.stringify({ dryRun: true, missingObjects, orphanObjects, legacyMetadata }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
