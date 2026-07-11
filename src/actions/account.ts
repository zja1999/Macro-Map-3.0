"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, groups, challenges, nutritionImportBatches } from "@/db/schema";
import { getCurrentUser, destroySession } from "@/lib/auth";

/**
 * Hard-delete the signed-in user and everything they own (Play/App Store account-
 * deletion requirement, overhaul plan Phase 4 §3b). Gated behind a typed "DELETE"
 * confirmation from the settings sheet — the client never uses window.confirm.
 *
 * Almost every user-owned table cascades from `users` (profiles, sessions, entries,
 * workouts, notifications, device_tokens, follows, posts, comments, reactions, …),
 * so deleting the user row clears them. Three tables carry a NOT NULL FK to users
 * WITHOUT `onDelete: cascade` and would otherwise block the delete, so we remove the
 * user's rows in those first, inside the same transaction:
 *   - nutrition_import_batches.uploadedBy  (admin import changelog)
 *   - challenges.createdBy                 (challenges the user authored)
 *   - groups.createdBy                     (groups the user created — cascades the
 *                                           group's members, challenges, posts)
 * Deleting a created group is intentional MVP behaviour; revisit if group hand-off
 * is added later.
 */
export async function deleteAccount(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") return { error: 'Type DELETE (all caps) to confirm.' };

  await db.transaction(async (tx) => {
    await tx.delete(nutritionImportBatches).where(eq(nutritionImportBatches.uploadedBy, user.id));
    await tx.delete(challenges).where(eq(challenges.createdBy, user.id));
    await tx.delete(groups).where(eq(groups.createdBy, user.id));
    await tx.delete(users).where(eq(users.id, user.id));
  });

  // Session rows are already gone via the users cascade; this just clears the cookie.
  await destroySession();
  redirect("/login");
}
