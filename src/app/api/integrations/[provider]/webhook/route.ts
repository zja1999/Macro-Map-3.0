import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { integrationAccounts } from "@/db/schema";
import { getProviderAdapter } from "@/lib/integrations/providers";
import { runIntegrationSync } from "@/lib/integrations/sync";

const MAX_WEBHOOK_BYTES = 256_000;

function webhookSecret(provider: string) {
  const envKey = `${provider.toUpperCase()}_WEBHOOK_SECRET`;
  return process.env[envKey] || (provider === "strava" ? process.env.STRAVA_WEBHOOK_VERIFY_TOKEN : undefined) || "";
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifySharedSecret(req: NextRequest, provider: string) {
  const secret = webhookSecret(provider);
  if (!secret) return false;
  const presented =
    req.headers.get("x-macromap-webhook-token") ||
    req.headers.get("x-webhook-token") ||
    req.nextUrl.searchParams.get("token") ||
    req.nextUrl.searchParams.get("verify_token") ||
    "";
  return Boolean(presented && safeEquals(presented, secret));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider === "strava") {
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    const mode = req.nextUrl.searchParams.get("hub.mode");
    const token = req.nextUrl.searchParams.get("hub.verify_token");
    const challenge = req.nextUrl.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === verifyToken && challenge) {
      return NextResponse.json({ "hub.challenge": challenge });
    }
  }
  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const adapter = getProviderAdapter(provider);
  if (!adapter) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (!verifySharedSecret(req, provider)) return NextResponse.json({ error: "Webhook authentication failed" }, { status: 401 });
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  const payload = await req.json().catch(() => null);
  const providerAccountId = payload?.owner_id != null ? String(payload.owner_id) : payload?.user_id != null ? String(payload.user_id) : null;
  const samples = adapter.normalizeWebhook?.(payload) ?? [];

  if (!providerAccountId) return NextResponse.json({ ok: true, samples: 0 });
  const [account] = await db
    .select()
    .from(integrationAccounts)
    .where(and(eq(integrationAccounts.provider, provider), eq(integrationAccounts.providerAccountId, providerAccountId)))
    .limit(1);
  if (!account) return NextResponse.json({ ok: true, samples: 0 });
  await runIntegrationSync(account, "webhook", samples);
  return NextResponse.json({ ok: true, samples: samples.length });
}
