import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts, profiles, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/email";

const STATE_COOKIE = "mm_oauth_state";

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

function authError(code: string) {
  return NextResponse.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(code)}`);
}

function baseUsername(email: string, name?: string) {
  const base = (name ?? email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  return (base || "user").slice(0, 20);
}

async function uniqueUsername(email: string, name?: string) {
  const base = baseUsername(email, name);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 20 - String(i).length)}${i}`;
    const [taken] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function exchangeCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) throw new Error("Google token exchange failed");
  return (await response.json()) as { access_token?: string };
}

async function readUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Google profile lookup failed");
  return (await response.json()) as GoogleUserInfo;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return authError("google_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) return authError("google_state");

  try {
    const token = await exchangeCode(code);
    if (!token.access_token) return authError("google_token");

    const google = await readUserInfo(token.access_token);
    const email = google.email?.toLowerCase().trim();
    if (!google.sub || !email || google.email_verified !== true) return authError("google_email");

    const [linked] = await db
      .select({ account: oauthAccounts, user: users })
      .from(oauthAccounts)
      .innerJoin(users, eq(oauthAccounts.userId, users.id))
      .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.providerAccountId, google.sub)))
      .limit(1);

    if (linked) {
      if (linked.user.bannedAt) return authError("account_suspended");
      await createSession(linked.user.id);
      return NextResponse.redirect(`${getAppUrl()}/`);
    }

    const [emailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (emailUser) {
      if (emailUser.bannedAt) return authError("account_suspended");
      if (!emailUser.emailVerifiedAt) return authError("verify_email_first");
      await db.insert(oauthAccounts).values({
        provider: "google",
        providerAccountId: google.sub,
        userId: emailUser.id,
        email,
      });
      await createSession(emailUser.id);
      return NextResponse.redirect(`${getAppUrl()}/`);
    }

    const displayName = google.name?.trim() || email.split("@")[0];
    const username = await uniqueUsername(email, displayName);
    const userId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ email, passwordHash: null, emailVerifiedAt: new Date() })
        .returning();
      await tx.insert(profiles).values({ userId: created.id, username, displayName });
      await tx.insert(oauthAccounts).values({
        provider: "google",
        providerAccountId: google.sub,
        userId: created.id,
        email,
      });
      return created.id;
    });

    await createSession(userId);
    return NextResponse.redirect(`${getAppUrl()}/onboarding`);
  } catch (err) {
    console.error("[auth] Google OAuth callback failed", err);
    return authError("google_failed");
  }
}
