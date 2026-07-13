import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { desktopPairingRequests } from "@/db/schema";
import { tokenHash } from "@/lib/authTokens";
import { desktopPairingStatus } from "@/lib/desktopPairing";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { deviceCode?: unknown } | null;
  const code = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!/^[a-f0-9]{64}$/.test(code)) return NextResponse.json({ status: "invalid" }, { status: 400 });
  const limit = await checkRequestRateLimit({
    kind: "macrotray_pair_status",
    identifier: await requestFingerprint(tokenHash(code)),
    limit: 450,
    windowMs: 15 * 60_000,
    label: "MacroTray pairing checks",
  });
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });
  const [row] = await db
    .select({
      approvedAt: desktopPairingRequests.approvedAt,
      consumedAt: desktopPairingRequests.consumedAt,
      expiresAt: desktopPairingRequests.expiresAt,
    })
    .from(desktopPairingRequests)
    .where(eq(desktopPairingRequests.deviceCodeHash, tokenHash(code)))
    .limit(1);
  const status = desktopPairingStatus(row);
  return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
