import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts, oauthAuthorizationFlows } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";
import {
  googleAuthorizationUrl,
  getGoogleConfig,
  GOOGLE_STATE_COOKIE,
  newGoogleState,
  type GoogleAuthPurpose,
} from "@/lib/googleAuth";
import { safeRedirectPath } from "@/lib/safeRedirect";

const PURPOSES = new Set<GoogleAuthPurpose>(["sign_in", "link", "recover", "reauthenticate"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPurpose = url.searchParams.get("purpose") as GoogleAuthPurpose | null;
  const purpose = requestedPurpose && PURPOSES.has(requestedPurpose) ? requestedPurpose : "sign_in";
  const defaultNext = purpose === "recover" ? "/settings?recovery=ready" : purpose === "sign_in" ? "" : "/settings";
  const nextPath = safeRedirectPath(url.searchParams.get("next"), defaultNext);
  const config = getGoogleConfig();
  if (!config) {
    const destination = new URL(purpose === "link" || purpose === "reauthenticate" ? "/settings" : "/login", request.url);
    destination.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(destination);
  }

  const sessionUser = purpose === "link" || purpose === "reauthenticate" ? await getSessionUser() : null;
  if ((purpose === "link" || purpose === "reauthenticate") && !sessionUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (purpose === "link" && !sessionUser?.hasPassword) return NextResponse.redirect(new URL("/account-setup", request.url));
  if (purpose === "reauthenticate") {
    const [linked] = await db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, sessionUser!.id), eq(oauthAccounts.provider, "google")))
      .limit(1);
    if (!linked) return NextResponse.redirect(new URL("/settings?error=google_reauthentication_failed", request.url));
  }

  const state = newGoogleState();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(oauthAuthorizationFlows).where(lt(oauthAuthorizationFlows.expiresAt, now));
    await tx.insert(oauthAuthorizationFlows).values({
      stateHash: tokenHash(state),
      provider: "google",
      purpose,
      userId: sessionUser?.id ?? null,
      sessionTokenHash: sessionUser?.sessionTokenHash ?? null,
      nextPath: nextPath || null,
      expiresAt: new Date(now.getTime() + 10 * 60_000),
    });
  });

  const response = NextResponse.redirect(googleAuthorizationUrl(config, state));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
