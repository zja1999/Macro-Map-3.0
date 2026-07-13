import { randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts, profiles, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { getGoogleConfig, getGoogleIdentity, GOOGLE_STATE_COOKIE } from "@/lib/googleAuth";
import { createWelcomeNotification } from "@/lib/welcomeNotification";
import { consumePostAuthNext } from "@/lib/postAuthNext";

function redirectToLogin(request: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
}

function statesMatch(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!statesMatch(expectedState, state)) return redirectToLogin(request, "google_state_invalid");

  const config = getGoogleConfig();
  const code = request.nextUrl.searchParams.get("code");
  if (!config || !code) return redirectToLogin(request, "google_sign_in_failed");

  const identity = await getGoogleIdentity(config, code);
  if (!identity || !identity.emailVerified) return redirectToLogin(request, "google_email_not_verified");

  const result = await db.transaction(async (tx) => {
    const [existingIdentity] = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.providerAccountId, identity.sub)))
      .limit(1);
    if (existingIdentity) {
      const [existingUser] = await tx
        .select({ id: users.id, bannedAt: users.bannedAt })
        .from(users)
        .where(eq(users.id, existingIdentity.userId))
        .limit(1);
      return existingUser && !existingUser.bannedAt ? { userId: existingUser.id, created: false } : null;
    }

    const [existingUser] = await tx.select().from(users).where(eq(users.email, identity.email)).limit(1);
    if (existingUser) {
      if (!existingUser.emailVerifiedAt || existingUser.bannedAt) return null;
      await tx.insert(oauthAccounts).values({
        provider: "google",
        providerAccountId: identity.sub,
        userId: existingUser.id,
        email: identity.email,
      });
      return { userId: existingUser.id, created: false };
    }

    const [user] = await tx
      .insert(users)
      .values({ email: identity.email, emailVerifiedAt: new Date(), passwordHash: null })
      .returning();
    await tx.insert(profiles).values({
      userId: user.id,
      username: `google_${randomBytes(8).toString("hex")}`,
      displayName: identity.name ?? identity.email.split("@")[0].slice(0, 40),
    });
    await tx.insert(oauthAccounts).values({
      provider: "google",
      providerAccountId: identity.sub,
      userId: user.id,
      email: identity.email,
    });
    return { userId: user.id, created: true };
  });

  if (!result) return redirectToLogin(request, "google_account_unavailable");
  if (result.created) await createWelcomeNotification(result.userId).catch(() => {});
  await createSession(result.userId);
  const [profile] = await db.select({ onboardedAt: profiles.onboardedAt }).from(profiles).where(eq(profiles.userId, result.userId)).limit(1);
  const destination = profile?.onboardedAt ? await consumePostAuthNext("/") : "/onboarding";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  return response;
}
