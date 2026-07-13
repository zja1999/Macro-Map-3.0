import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { desktopPairingRequests } from "@/db/schema";
import { newPublicToken, tokenHash } from "@/lib/authTokens";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";

export async function POST() {
  const limit = await checkRequestRateLimit({
    kind: "macrotray_pair_start",
    identifier: await requestFingerprint(),
    limit: 10,
    windowMs: 15 * 60_000,
    label: "MacroTray pairing attempts",
  });
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  const deviceCode = newPublicToken();
  const approvalCode = newPublicToken();
  await db.insert(desktopPairingRequests).values({
    deviceCodeHash: tokenHash(deviceCode),
    approvalCodeHash: tokenHash(approvalCode),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return NextResponse.json(
    { deviceCode, approvalUrl: `/macrotray-connect?code=${encodeURIComponent(approvalCode)}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
