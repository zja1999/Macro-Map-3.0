import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { isMissingTableError } from "@/lib/dbErrors";
import { sendPushToUser } from "@/lib/push";

export type NotificationInsert = typeof notifications.$inferInsert;

/**
 * The one place a notification is born. Writes the in-app
 * `notifications` row(s) AND fans out a push to each recipient's devices, so the two
 * stay in lockstep — every call site that used to insert directly now goes through here.
 *
 * Both halves degrade gracefully: a missing `notifications` table (older DB) makes the
 * whole call a no-op, and the push fan-out is best-effort (no-op when FCM is
 * unconfigured, and per-recipient failures never surface to the caller).
 */
export async function createNotifications(input: NotificationInsert | NotificationInsert[]): Promise<void> {
  const rows = Array.isArray(input) ? input : [input];
  if (!rows.length) return;

  try {
    await db.insert(notifications).values(rows);
  } catch (error) {
    if (isMissingTableError(error, "notifications")) return;
    throw error;
  }

  await Promise.all(
    rows.map((r) =>
      sendPushToUser(r.userId, { title: "MacroVerse", body: r.message, href: r.href }).catch(() => {}),
    ),
  );
}
