"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { desktopPairingRequests } from "@/db/schema";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";

export async function approveMacroTrayPairing(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in before approving MacroTray." };
  if (!user.profile.onboardedAt) return { error: "Finish account setup before connecting MacroTray." };
  const code = z.string().length(64).safeParse(formData.get("code"));
  if (!code.success) return { error: "That pairing request is invalid." };
  const limit = await checkRequestRateLimit({
    kind: "macrotray_pair_approval",
    identifier: await requestFingerprint(user.id),
    limit: 20,
    windowMs: 15 * 60_000,
    label: "MacroTray approval attempts",
  });
  if (limit) return { error: limit };
  const now = new Date();
  const [row] = await db
    .update(desktopPairingRequests)
    .set({ userId: user.id, approvedAt: now })
    .where(
      and(
        eq(desktopPairingRequests.approvalCodeHash, tokenHash(code.data)),
        gt(desktopPairingRequests.expiresAt, now),
        isNull(desktopPairingRequests.userId),
        isNull(desktopPairingRequests.approvedAt),
        isNull(desktopPairingRequests.consumedAt),
      ),
    )
    .returning({ deviceCodeHash: desktopPairingRequests.deviceCodeHash });
  if (!row) return { error: "That pairing request expired or was already approved. Start again from MacroTray." };
  return { ok: true };
}

export async function logoutMacroTray() {
  await destroySession();
  revalidatePath("/macrotray");
}
