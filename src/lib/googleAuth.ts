import { randomBytes } from "crypto";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "mm_google_oauth_state";

export type GoogleAuthPurpose = "sign_in" | "link" | "recover" | "reauthenticate";

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? null;
}

export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = appUrl();
  if (!clientId || !clientSecret || !baseUrl) return null;
  return { clientId, clientSecret, redirectUri: `${baseUrl}/api/auth/google/callback` };
}

export function newGoogleState() {
  return randomBytes(32).toString("hex");
}

export function googleAuthorizationUrl(config: GoogleConfig, state: string) {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return url;
}

export async function getGoogleIdentity(config: GoogleConfig, code: string): Promise<GoogleIdentity | null> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return null;

  const token = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof token.access_token !== "string" || !token.access_token) return null;

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!userInfoResponse.ok) return null;

  const userInfo = (await userInfoResponse.json()) as Record<string, unknown>;
  if (typeof userInfo.sub !== "string" || typeof userInfo.email !== "string") return null;
  return {
    sub: userInfo.sub,
    email: userInfo.email.toLowerCase().trim(),
    emailVerified: userInfo.email_verified === true || userInfo.email_verified === "true",
    name: typeof userInfo.name === "string" && userInfo.name.trim() ? userInfo.name.trim().slice(0, 40) : null,
  };
}
