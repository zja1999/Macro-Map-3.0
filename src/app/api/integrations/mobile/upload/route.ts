import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { upsertIntegrationAccount, runIntegrationSync } from "@/lib/integrations/sync";
import type { IntegrationProvider, NormalizedSample } from "@/lib/integrations/types";

const providerSchema = z.enum(["apple_health", "health_connect"]);

const sampleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("daily_metric"),
    provider: providerSchema,
    externalId: z.string().min(1),
    metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    steps: z.number().int().min(0).nullable().optional(),
    activeEnergyKcal: z.number().min(0).nullable().optional(),
    restingHeartRateBpm: z.number().min(20).max(240).nullable().optional(),
    hrvMs: z.number().min(0).max(500).nullable().optional(),
  }),
  z.object({
    kind: z.literal("workout"),
    provider: providerSchema,
    externalId: z.string().min(1),
    performedAt: z.coerce.date(),
    durationMin: z.number().min(0.5).max(1440),
    activityType: z.enum(["outdoor_run", "treadmill_run", "rowing", "stationary_bike", "outdoor_bike", "walk", "hike", "elliptical", "generic_cardio"]),
    distanceM: z.number().min(0).nullable().optional(),
    calories: z.number().min(0).nullable().optional(),
    activeEnergyKcal: z.number().min(0).nullable().optional(),
    elevationGainM: z.number().min(0).nullable().optional(),
    title: z.string().max(120).nullable().optional(),
    route: z
      .object({
        externalId: z.string().nullable().optional(),
        encodedPolyline: z.string().nullable().optional(),
        distanceM: z.number().min(0).nullable().optional(),
        elevationGainM: z.number().min(0).nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  z.object({
    kind: z.literal("sleep"),
    provider: providerSchema,
    externalId: z.string().min(1),
    sleepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMin: z.number().int().min(1).max(1440),
  }),
  z.object({
    kind: z.literal("progress"),
    provider: providerSchema,
    externalId: z.string().min(1),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weightKg: z.number().min(20).max(400).nullable().optional(),
    bodyFatPct: z.number().min(1).max(75).nullable().optional(),
  }),
]);

const bodySchema = z.object({
  provider: providerSchema,
  providerAccountId: z.string().optional(),
  samples: z.array(sampleSchema).max(500),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload" }, { status: 400 });
  const { provider, providerAccountId, samples } = parsed.data;
  const account = await upsertIntegrationAccount({
    userId: user.id,
    provider: provider as IntegrationProvider,
    providerAccountId: providerAccountId ?? `${provider}:${user.id}`,
    displayName: provider === "apple_health" ? "Apple Health" : "Health Connect",
    scopes: [...new Set(samples.flatMap((sample) => sample.kind))],
  });
  const result = await runIntegrationSync(account, "mobile_upload", samples as NormalizedSample[]);
  return NextResponse.json({ ok: true, ...result });
}
