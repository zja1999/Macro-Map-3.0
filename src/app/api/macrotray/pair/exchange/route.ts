import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { desktopPairingRequests, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const limit = await checkRequestRateLimit({
    kind: "macrotray_pair_exchange",
    identifier: await requestFingerprint(),
    limit: 20,
    windowMs: 15 * 60_000,
    label: "MacroTray session exchanges",
  });
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { deviceCode?: unknown } | null;
  const code = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!/^[a-f0-9]{64}$/.test(code)) return NextResponse.json({ error: "Invalid pairing code" }, { status: 400 });

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ deviceCodeHash: desktopPairingRequests.deviceCodeHash, userId: desktopPairingRequests.userId, bannedAt: users.bannedAt })
      .from(desktopPairingRequests)
      .innerJoin(users, eq(users.id, desktopPairingRequests.userId))
      .where(
        and(
          eq(desktopPairingRequests.deviceCodeHash, tokenHash(code)),
          gt(desktopPairingRequests.expiresAt, now),
          isNotNull(desktopPairingRequests.approvedAt),
          isNull(desktopPairingRequests.consumedAt),
        ),
      )
      .limit(1);
    if (!row || row.bannedAt) return null;
    const consumed = await tx
      .update(desktopPairingRequests)
      .set({ consumedAt: now })
      .where(and(eq(desktopPairingRequests.deviceCodeHash, row.deviceCodeHash), isNull(desktopPairingRequests.consumedAt)))
      .returning({ deviceCodeHash: desktopPairingRequests.deviceCodeHash });
    return consumed[0] ? row.userId : null;
  });
  if (!result) return NextResponse.json({ error: "Pairing request expired or was already used" }, { status: 409 });
  await createSession(result);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
