import { createSign } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { deviceTokens } from "@/db/schema";
import { isMissingTableError } from "@/lib/dbErrors";

/**
 * Server-side FCM sender using the HTTP v1 API (overhaul plan Phase 4 §3a). Kept
 * dependency-free — a service-account JWT is signed with Node crypto, exchanged for
 * an OAuth2 access token, and used to POST to the v1 `messages:send` endpoint.
 *
 * Configuration comes entirely from env vars (never the repo/bundle), so it is safe
 * to import anywhere server-side. When the vars are absent (local dev, or Firebase
 * not provisioned yet) every entry point is a silent no-op — the app still writes the
 * in-app notification row, it just doesn't push.
 *
 * Required Vercel env vars (from the Firebase service-account JSON):
 *   FCM_PROJECT_ID    – e.g. "macroverse-1234"
 *   FCM_CLIENT_EMAIL  – "...@....iam.gserviceaccount.com"
 *   FCM_PRIVATE_KEY   – the PEM private key. Vercel stores newlines as literal "\n";
 *                       we restore them below, so paste the key verbatim.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";

export type PushPayload = { title: string; body: string; href?: string };

type Config = { projectId: string; clientEmail: string; privateKey: string };

function config(): Config | null {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/** Whether FCM credentials are present. Handy for health checks / diagnostics. */
export function isPushConfigured(): boolean {
  return config() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// OAuth2 access-token cache; lives for a warm lambda's lifetime (~1h token TTL).
let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(cfg: Config): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(cfg.privateKey));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion: `${signingInput}.${signature}` }),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function sendToToken(
  cfg: Config,
  accessToken: string,
  token: string,
  payload: PushPayload,
): Promise<"ok" | "stale" | "error"> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        // data must be string→string; the shell reads `href` to deep-link on tap.
        ...(payload.href ? { data: { href: payload.href } } : {}),
        android: { notification: { sound: "default" } },
      },
    }),
  });
  if (res.ok) return "ok";
  // 404 UNREGISTERED / 400 invalid-argument → the token is dead; prune it.
  if (res.status === 404 || res.status === 400) return "stale";
  return "error";
}

/**
 * Push `payload` to every device registered to `userId`. Best-effort: a missing table
 * or unconfigured FCM is a no-op, individual send failures are swallowed, and tokens
 * FCM reports as unregistered are pruned so they don't accumulate.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  let tokens: { token: string }[];
  try {
    tokens = await db.select({ token: deviceTokens.token }).from(deviceTokens).where(eq(deviceTokens.userId, userId));
  } catch (error) {
    if (isMissingTableError(error, "device_tokens")) return;
    throw error;
  }
  if (!tokens.length) return;

  const accessToken = await getAccessToken(cfg);
  const stale: string[] = [];
  await Promise.all(
    tokens.map(async ({ token }) => {
      try {
        if ((await sendToToken(cfg, accessToken, token, payload)) === "stale") stale.push(token);
      } catch {
        /* one dead token must not sink the rest */
      }
    }),
  );

  if (stale.length) {
    try {
      await db.delete(deviceTokens).where(inArray(deviceTokens.token, stale));
    } catch {
      /* pruning is best-effort */
    }
  }
}
