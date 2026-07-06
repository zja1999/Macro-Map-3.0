"use server";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { integrationAccounts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { configuredForOAuth, getProviderAdapter } from "@/lib/integrations/providers";
import { disconnectIntegration, runIntegrationSync } from "@/lib/integrations/sync";
import type { IntegrationProvider } from "@/lib/integrations/types";

const providerSchema = z.enum(["strava", "fitbit", "whoop", "oura", "withings", "apple_health", "health_connect", "garmin"]);

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function connectIntegration(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const provider = providerSchema.parse(formData.get("provider")) as IntegrationProvider;
  const adapter = getProviderAdapter(provider);
  if (!adapter || adapter.availability !== "web_oauth" || !adapter.getAuthorizationUrl) {
    redirect(`/settings/integrations?error=${encodeURIComponent("That provider needs the native app or vendor approval first.")}`);
  }
  if (!configuredForOAuth(provider)) {
    redirect(`/settings/integrations?error=${encodeURIComponent(`${adapter.label} OAuth credentials are not configured yet.`)}`);
  }
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set(`mm_oauth_${provider}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  const redirectUri = `${appUrl()}/api/integrations/${provider}/callback`;
  redirect(adapter.getAuthorizationUrl(state, redirectUri));
}

export async function disconnectIntegrationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  await disconnectIntegration(user.id, accountId);
  revalidatePath("/settings/integrations");
}

export async function syncIntegrationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  const [account] = await db
    .select()
    .from(integrationAccounts)
    .where(and(eq(integrationAccounts.id, accountId), eq(integrationAccounts.userId, user.id)))
    .limit(1);
  if (!account) return;
  await runIntegrationSync(account, "manual");
  revalidatePath("/settings/integrations");
  revalidatePath("/progress");
  revalidatePath("/workouts");
}
