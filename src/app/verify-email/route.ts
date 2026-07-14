import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { emailVerificationTokens, users } from "@/db/schema";
import { createAuthenticatedSession } from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const hash = tokenHash(token);
  const now = new Date();

  const userId = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(emailVerificationTokens)
      .where(and(eq(emailVerificationTokens.tokenHash, hash), isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, now)))
      .limit(1);
    if (!row) return null;
    await tx.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.tokenHash, hash));
    await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, row.userId));
    return row.userId;
  });

  if (!userId) return NextResponse.redirect(new URL("/verify-email/sent?status=invalid", req.url));
  await createAuthenticatedSession(userId);
  return NextResponse.redirect(new URL("/onboarding", req.url));
}
