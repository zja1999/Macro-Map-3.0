"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { deviceTokens } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isMissingTableError } from "@/lib/dbErrors";

const schema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["android", "ios", "web"]),
});

/**
 * Register (or refresh) an FCM device token for the signed-in user. Called from the
 * native shell after the push plugin hands back a token (src/components/NativeInit.tsx).
 * Idempotent: the token is the PK, so re-registering upserts and reassigns the token to
 * whoever is currently signed in on that device. No-ops if the table isn't migrated yet.
 */
export async function registerDeviceToken(input: { token: string; platform: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const now = new Date();
  try {
    await db
      .insert(deviceTokens)
      .values({ token: parsed.data.token, userId: user.id, platform: parsed.data.platform, lastSeenAt: now })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId: user.id, platform: parsed.data.platform, lastSeenAt: now },
      });
  } catch (error) {
    if (isMissingTableError(error, "device_tokens")) return { ok: false };
    throw error;
  }
  return { ok: true };
}
