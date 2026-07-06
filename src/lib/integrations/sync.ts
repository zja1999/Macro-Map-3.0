import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyHealthMetrics,
  exercises,
  externalSampleLinks,
  integrationAccounts,
  integrationSyncRuns,
  progressEntries,
  sleepLogs,
  sleepStageSamples,
  workoutLogs,
  workoutRoutes,
  type ActivityType,
  type WorkoutLogEntries,
} from "@/db/schema";
import { decryptToken, encryptToken } from "./crypto";
import { getProviderAdapter } from "./providers";
import type { IntegrationProvider, NormalizedProgress, NormalizedSample, NormalizedSleep, NormalizedWorkout } from "./types";
import { workoutEntryFromSample } from "./types";

export type IntegrationAccountRow = typeof integrationAccounts.$inferSelect;

export async function listIntegrationAccounts(userId: string) {
  const accounts = await db
    .select()
    .from(integrationAccounts)
    .where(eq(integrationAccounts.userId, userId))
    .orderBy(integrationAccounts.provider);
  const runs = accounts.length
    ? await Promise.all(
        accounts.map(async (account) => {
          const [run] = await db
            .select()
            .from(integrationSyncRuns)
            .where(eq(integrationSyncRuns.accountId, account.id))
            .orderBy(desc(integrationSyncRuns.startedAt))
            .limit(1);
          return [account.id, run ?? null] as const;
        }),
      )
    : [];
  return { accounts, latestRunByAccountId: new Map(runs) };
}

export async function upsertIntegrationAccount(input: {
  userId: string;
  provider: IntegrationProvider;
  providerAccountId?: string | null;
  displayName?: string | null;
  scopes?: string[];
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}) {
  const [existing] = await db
    .select()
    .from(integrationAccounts)
    .where(and(eq(integrationAccounts.userId, input.userId), eq(integrationAccounts.provider, input.provider)))
    .limit(1);
  const values = {
    providerAccountId: input.providerAccountId ?? existing?.providerAccountId ?? null,
    displayName: input.displayName ?? existing?.displayName ?? null,
    scopes: input.scopes ?? existing?.scopes ?? [],
    accessTokenCiphertext: input.accessToken ? encryptToken(input.accessToken) : existing?.accessTokenCiphertext ?? null,
    refreshTokenCiphertext: input.refreshToken ? encryptToken(input.refreshToken) : existing?.refreshTokenCiphertext ?? null,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    status: "connected",
    statusMessage: null,
    updatedAt: new Date(),
  };
  if (existing) {
    const [account] = await db.update(integrationAccounts).set(values).where(eq(integrationAccounts.id, existing.id)).returning();
    return account;
  }
  const [account] = await db
    .insert(integrationAccounts)
    .values({
      userId: input.userId,
      provider: input.provider,
      ...values,
      syncSettings: { metrics: {}, backfillDays: 30 },
    })
    .returning();
  return account;
}

export async function disconnectIntegration(userId: string, accountId: string) {
  await db
    .update(integrationAccounts)
    .set({
      status: "disabled",
      accessTokenCiphertext: null,
      refreshTokenCiphertext: null,
      statusMessage: "Disconnected by user",
      updatedAt: new Date(),
    })
    .where(and(eq(integrationAccounts.id, accountId), eq(integrationAccounts.userId, userId)));
}

async function linked(provider: IntegrationProvider, externalId: string, subjectType: string) {
  const [row] = await db
    .select()
    .from(externalSampleLinks)
    .where(and(eq(externalSampleLinks.provider, provider), eq(externalSampleLinks.externalId, externalId), eq(externalSampleLinks.subjectType, subjectType)))
    .limit(1);
  return row ?? null;
}

async function linkSample(input: {
  provider: IntegrationProvider;
  externalId: string;
  userId: string;
  accountId?: string | null;
  subjectType: string;
  subjectId: string;
  sourceUpdatedAt?: Date | null;
}) {
  await db
    .insert(externalSampleLinks)
    .values(input)
    .onConflictDoUpdate({
      target: [externalSampleLinks.provider, externalSampleLinks.externalId, externalSampleLinks.subjectType],
      set: { subjectId: input.subjectId, sourceUpdatedAt: input.sourceUpdatedAt ?? null },
    });
}

async function exerciseForActivity(activityType: ActivityType) {
  const [row] = await db.select().from(exercises).where(eq(exercises.activityType, activityType)).limit(1);
  return row?.id ?? null;
}

async function upsertDailyMetric(userId: string, accountId: string | null, sample: Extract<NormalizedSample, { kind: "daily_metric" }>) {
  const existing = await linked(sample.provider, sample.externalId, "daily_health_metric");
  if (existing) {
    await db
      .update(dailyHealthMetrics)
      .set({
        steps: sample.steps ?? null,
        activeEnergyKcal: sample.activeEnergyKcal ?? null,
        restingHeartRateBpm: sample.restingHeartRateBpm ?? null,
        hrvMs: sample.hrvMs ?? null,
        updatedAt: new Date(),
      })
      .where(eq(dailyHealthMetrics.id, existing.subjectId));
    return 0;
  }
  const [row] = await db
    .insert(dailyHealthMetrics)
    .values({
      userId,
      metricDate: sample.metricDate,
      source: sample.provider,
      externalProvider: sample.provider,
      externalId: sample.externalId,
      steps: sample.steps ?? null,
      activeEnergyKcal: sample.activeEnergyKcal ?? null,
      restingHeartRateBpm: sample.restingHeartRateBpm ?? null,
      hrvMs: sample.hrvMs ?? null,
    })
    .returning({ id: dailyHealthMetrics.id });
  await linkSample({ provider: sample.provider, externalId: sample.externalId, userId, accountId, subjectType: "daily_health_metric", subjectId: row.id, sourceUpdatedAt: sample.sourceUpdatedAt });
  return 1;
}

async function upsertWorkout(userId: string, accountId: string | null, sample: NormalizedWorkout) {
  const existing = await linked(sample.provider, sample.externalId, "workout_log");
  if (existing) return 0;
  const exerciseId = await exerciseForActivity(sample.activityType);
  const entries: WorkoutLogEntries = [workoutEntryFromSample(sample, exerciseId)];
  const [log] = await db
    .insert(workoutLogs)
    .values({
      userId,
      performedAt: sample.performedAt,
      durationMin: Math.round(sample.durationMin),
      notes: sample.title ?? `Imported from ${sample.provider}`,
      entries,
      source: sample.provider,
      externalProvider: sample.provider,
      externalId: sample.externalId,
    })
    .returning({ id: workoutLogs.id });
  await linkSample({ provider: sample.provider, externalId: sample.externalId, userId, accountId, subjectType: "workout_log", subjectId: log.id, sourceUpdatedAt: sample.sourceUpdatedAt });
  if (sample.route?.encodedPolyline) {
    const routeExternalId = sample.route.externalId || `${sample.externalId}:route`;
    const [route] = await db
      .insert(workoutRoutes)
      .values({
        userId,
        workoutLogId: log.id,
        source: sample.provider,
        externalProvider: sample.provider,
        externalId: routeExternalId,
        encodedPolyline: sample.route.encodedPolyline,
        distanceM: sample.route.distanceM ?? sample.distanceM ?? null,
        elevationGainM: sample.route.elevationGainM ?? sample.elevationGainM ?? null,
        privacyStatus: "private",
      })
      .returning({ id: workoutRoutes.id });
    await linkSample({ provider: sample.provider, externalId: routeExternalId, userId, accountId, subjectType: "workout_route", subjectId: route.id });
  }
  return 1;
}

async function upsertSleep(userId: string, accountId: string | null, sample: NormalizedSleep) {
  const [existing] = await db
    .select()
    .from(sleepLogs)
    .where(and(eq(sleepLogs.userId, userId), eq(sleepLogs.sleepDate, sample.sleepDate)))
    .limit(1);
  if (existing?.source === "manual") return 0;
  await db
    .insert(sleepLogs)
    .values({
      userId,
      sleepDate: sample.sleepDate,
      bedTime: sample.bedTime,
      wakeTime: sample.wakeTime,
      durationMin: sample.durationMin,
      source: sample.provider,
      externalProvider: sample.provider,
      externalId: sample.externalId,
    })
    .onConflictDoUpdate({
      target: [sleepLogs.userId, sleepLogs.sleepDate],
      set: {
        bedTime: sample.bedTime,
        wakeTime: sample.wakeTime,
        durationMin: sample.durationMin,
        source: sample.provider,
        externalProvider: sample.provider,
        externalId: sample.externalId,
      },
    });
  await linkSample({ provider: sample.provider, externalId: sample.externalId, userId, accountId, subjectType: "sleep_log", subjectId: `${userId}:${sample.sleepDate}`, sourceUpdatedAt: sample.sourceUpdatedAt });
  for (const stage of sample.stages ?? []) {
    if (await linked(sample.provider, stage.externalId, "sleep_stage_sample")) continue;
    const [row] = await db
      .insert(sleepStageSamples)
      .values({ userId, sleepDate: sample.sleepDate, source: sample.provider, externalProvider: sample.provider, externalId: stage.externalId, stage: stage.stage, startedAt: stage.startedAt, endedAt: stage.endedAt })
      .returning({ id: sleepStageSamples.id });
    await linkSample({ provider: sample.provider, externalId: stage.externalId, userId, accountId, subjectType: "sleep_stage_sample", subjectId: row.id });
  }
  return existing ? 0 : 1;
}

async function upsertProgress(userId: string, accountId: string | null, sample: NormalizedProgress) {
  const existing = await linked(sample.provider, sample.externalId, "progress_entry");
  if (existing) return 0;
  const [manual] = await db
    .select()
    .from(progressEntries)
    .where(and(eq(progressEntries.userId, userId), eq(progressEntries.entryDate, sample.entryDate), eq(progressEntries.source, "manual")))
    .limit(1);
  if (manual) return 0;
  const [row] = await db
    .insert(progressEntries)
    .values({
      userId,
      entryDate: sample.entryDate,
      weightKg: sample.weightKg ?? null,
      bodyFatPct: sample.bodyFatPct ?? null,
      source: sample.provider,
      externalProvider: sample.provider,
      externalId: sample.externalId,
    })
    .returning({ id: progressEntries.id });
  await linkSample({ provider: sample.provider, externalId: sample.externalId, userId, accountId, subjectType: "progress_entry", subjectId: row.id, sourceUpdatedAt: sample.sourceUpdatedAt });
  return 1;
}

export async function applyNormalizedSamples(userId: string, accountId: string | null, samples: NormalizedSample[]) {
  let written = 0;
  for (const sample of samples) {
    if (sample.kind === "daily_metric") written += await upsertDailyMetric(userId, accountId, sample);
    if (sample.kind === "workout") written += await upsertWorkout(userId, accountId, sample);
    if (sample.kind === "sleep") written += await upsertSleep(userId, accountId, sample);
    if (sample.kind === "progress") written += await upsertProgress(userId, accountId, sample);
  }
  return { read: samples.length, written };
}

export async function runIntegrationSync(account: IntegrationAccountRow, kind: "backfill" | "manual" | "webhook" | "mobile_upload", samples?: NormalizedSample[]) {
  const [run] = await db.insert(integrationSyncRuns).values({ accountId: account.id, userId: account.userId, provider: account.provider, kind }).returning();
  try {
    const adapter = getProviderAdapter(account.provider);
    const token = decryptToken(account.accessTokenCiphertext);
    const backfillDays = account.syncSettings?.backfillDays ?? 30;
    const fetched = samples
      ? { samples }
      : adapter?.fetchBackfill && token
        ? await adapter.fetchBackfill({ accessToken: token, since: new Date(Date.now() - backfillDays * 86400_000), cursor: account.lastSyncCursor })
        : { samples: [] };
    const result = await applyNormalizedSamples(account.userId, account.id, fetched.samples);
    await db.update(integrationSyncRuns).set({ status: "success", finishedAt: new Date(), samplesRead: result.read, samplesWritten: result.written }).where(eq(integrationSyncRuns.id, run.id));
    await db.update(integrationAccounts).set({ lastSyncedAt: new Date(), lastSyncCursor: fetched.nextCursor ?? account.lastSyncCursor, status: "connected", statusMessage: null, updatedAt: new Date() }).where(eq(integrationAccounts.id, account.id));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await db.update(integrationSyncRuns).set({ status: "error", finishedAt: new Date(), errorMessage: message }).where(eq(integrationSyncRuns.id, run.id));
    await db.update(integrationAccounts).set({ status: "error", statusMessage: message, updatedAt: new Date() }).where(eq(integrationAccounts.id, account.id));
    throw error;
  }
}
