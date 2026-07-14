import { timingSafeEqual, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts, oauthAuthorizationFlows, profiles, sessions, users } from "@/db/schema";
import { createAuthenticatedSession, getSessionUser } from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";
import { getGoogleConfig, getGoogleIdentity, GOOGLE_STATE_COOKIE, type GoogleAuthPurpose } from "@/lib/googleAuth";
import { createWelcomeNotification } from "@/lib/welcomeNotification";
import { POST_AUTH_NEXT_COOKIE } from "@/lib/postAuthNext";

function statesMatch(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function errorDestination(request: NextRequest, purpose: GoogleAuthPurpose | undefined, error: string, nextPath?: string | null) {
  const path = purpose === "link" || purpose === "reauthenticate" ? nextPath ?? "/settings" : "/login";
  const url = new URL(path, request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const receivedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!statesMatch(expectedState, receivedState)) return errorDestination(request, undefined, "google_state_invalid");

  const now = new Date();
  const [initialFlow] = await db
    .select()
    .from(oauthAuthorizationFlows)
    .where(and(
      eq(oauthAuthorizationFlows.stateHash, tokenHash(receivedState!)),
      isNull(oauthAuthorizationFlows.usedAt),
      gt(oauthAuthorizationFlows.expiresAt, now),
    ))
    .limit(1);
  if (!initialFlow) return errorDestination(request, undefined, "google_state_invalid");
  const purpose = initialFlow.purpose as GoogleAuthPurpose;

  const config = getGoogleConfig();
  const code = request.nextUrl.searchParams.get("code");
  if (!config || !code) return errorDestination(request, purpose, "google_sign_in_failed", initialFlow.nextPath);
  const identity = await getGoogleIdentity(config, code);
  if (!identity?.emailVerified) return errorDestination(request, purpose, "google_email_not_verified", initialFlow.nextPath);

  const boundSession = purpose === "link" || purpose === "reauthenticate" ? await getSessionUser() : null;
  if ((purpose === "link" || purpose === "reauthenticate") && (
    !boundSession
    || (purpose === "link" && !boundSession.hasPassword)
    || boundSession.id !== initialFlow.userId
    || boundSession.sessionTokenHash !== initialFlow.sessionTokenHash
  )) {
    return errorDestination(request, purpose, purpose === "link" ? "google_link_conflict" : "google_reauthentication_failed", initialFlow.nextPath);
  }

  const result = await db.transaction(async (tx) => {
    const [flow] = await tx
      .select()
      .from(oauthAuthorizationFlows)
      .where(and(
        eq(oauthAuthorizationFlows.stateHash, initialFlow.stateHash),
        isNull(oauthAuthorizationFlows.usedAt),
        gt(oauthAuthorizationFlows.expiresAt, now),
      ))
      .limit(1);
    if (!flow) return { kind: "error" as const, code: "google_state_invalid" };
    await tx.update(oauthAuthorizationFlows).set({ usedAt: now }).where(eq(oauthAuthorizationFlows.stateHash, flow.stateHash));

    const [providerIdentity] = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.providerAccountId, identity.sub)))
      .limit(1);

    if (purpose === "recover") {
      if (!providerIdentity) return { kind: "error" as const, code: "google_recovery_unavailable" };
      const [account] = await tx.select().from(users).where(eq(users.id, providerIdentity.userId)).limit(1);
      if (!account || account.bannedAt) return { kind: "error" as const, code: "google_recovery_unavailable" };
      const [profile] = await tx.select({ onboardedAt: profiles.onboardedAt }).from(profiles).where(eq(profiles.userId, account.id)).limit(1);
      return { kind: "session" as const, userId: account.id, hasPassword: !!account.passwordHash, onboardedAt: profile?.onboardedAt ?? null, created: false };
    }

    if (purpose === "link") {
      const userId = boundSession!.id;
      if (providerIdentity && providerIdentity.userId !== userId) return { kind: "error" as const, code: "google_link_conflict" };
      const [existingForUser] = await tx
        .select({ providerAccountId: oauthAccounts.providerAccountId })
        .from(oauthAccounts)
        .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, "google")))
        .limit(1);
      if (existingForUser && existingForUser.providerAccountId !== identity.sub) {
        return { kind: "error" as const, code: "google_link_conflict" };
      }
      const [emailOwner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, identity.email), isNotNull(users.emailVerifiedAt), ne(users.id, userId)))
        .limit(1);
      if (emailOwner) return { kind: "error" as const, code: "google_link_conflict" };
      if (!providerIdentity && !existingForUser) {
        await tx.insert(oauthAccounts).values({ provider: "google", providerAccountId: identity.sub, userId, email: identity.email });
      }
      await tx.update(sessions).set({ reauthenticatedAt: now }).where(eq(sessions.tokenHash, boundSession!.sessionTokenHash));
      return { kind: "linked" as const };
    }

    if (purpose === "reauthenticate") {
      if (!providerIdentity || providerIdentity.userId !== boundSession!.id) {
        return { kind: "error" as const, code: "google_reauthentication_failed" };
      }
      await tx.update(sessions).set({ reauthenticatedAt: now }).where(eq(sessions.tokenHash, boundSession!.sessionTokenHash));
      return { kind: "reauthenticated" as const };
    }

    if (providerIdentity) {
      const [account] = await tx.select().from(users).where(eq(users.id, providerIdentity.userId)).limit(1);
      if (!account || account.bannedAt) return { kind: "error" as const, code: "google_account_unavailable" };
      const [profile] = await tx.select({ onboardedAt: profiles.onboardedAt }).from(profiles).where(eq(profiles.userId, account.id)).limit(1);
      return { kind: "session" as const, userId: account.id, hasPassword: !!account.passwordHash, onboardedAt: profile?.onboardedAt ?? null, created: false };
    }

    const [existingUser] = await tx.select().from(users).where(eq(users.email, identity.email)).limit(1);
    if (existingUser) {
      if (!existingUser.emailVerifiedAt || existingUser.bannedAt) return { kind: "error" as const, code: "google_account_unavailable" };
      const [existingGoogle] = await tx
        .select({ providerAccountId: oauthAccounts.providerAccountId })
        .from(oauthAccounts)
        .where(and(eq(oauthAccounts.userId, existingUser.id), eq(oauthAccounts.provider, "google")))
        .limit(1);
      if (existingGoogle) return { kind: "error" as const, code: "google_account_unavailable" };
      await tx.insert(oauthAccounts).values({ provider: "google", providerAccountId: identity.sub, userId: existingUser.id, email: identity.email });
      const [profile] = await tx.select({ onboardedAt: profiles.onboardedAt }).from(profiles).where(eq(profiles.userId, existingUser.id)).limit(1);
      return { kind: "session" as const, userId: existingUser.id, hasPassword: !!existingUser.passwordHash, onboardedAt: profile?.onboardedAt ?? null, created: false };
    }

    const [user] = await tx.insert(users).values({ email: identity.email, emailVerifiedAt: now, passwordHash: null }).returning();
    await tx.insert(profiles).values({
      userId: user.id,
      username: `google_${randomBytes(8).toString("hex")}`,
      displayName: identity.name ?? identity.email.split("@")[0].slice(0, 40),
    });
    await tx.insert(oauthAccounts).values({ provider: "google", providerAccountId: identity.sub, userId: user.id, email: identity.email });
    return { kind: "session" as const, userId: user.id, hasPassword: false, onboardedAt: null, created: true };
  });

  if (result.kind === "error") return errorDestination(request, purpose, result.code, initialFlow.nextPath);
  if (result.kind === "linked" || result.kind === "reauthenticated") {
    const destination = new URL(initialFlow.nextPath ?? "/settings", request.url);
    destination.searchParams.set(result.kind === "linked" ? "google" : "reauthenticated", result.kind === "linked" ? "linked" : "1");
    const response = NextResponse.redirect(destination);
    response.cookies.delete(GOOGLE_STATE_COOKIE);
    return response;
  }

  if (result.created) await createWelcomeNotification(result.userId).catch(() => {});
  await createAuthenticatedSession(result.userId);
  let destination: string;
  if (!result.hasPassword) destination = "/account-setup";
  else if (!result.onboardedAt) destination = initialFlow.nextPath
    ? `/onboarding?next=${encodeURIComponent(initialFlow.nextPath)}`
    : "/onboarding";
  else destination = initialFlow.nextPath ?? (purpose === "recover" ? "/settings?recovery=ready" : "/");
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  if (!result.hasPassword && initialFlow.nextPath) {
    response.cookies.set(POST_AUTH_NEXT_COOKIE, initialFlow.nextPath, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 20 * 60,
      path: "/",
    });
  }
  return response;
}
