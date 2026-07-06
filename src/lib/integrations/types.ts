import type { ActivityType, CardioLogEntry } from "@/db/schema";

export type IntegrationProvider =
  | "strava"
  | "fitbit"
  | "whoop"
  | "oura"
  | "withings"
  | "apple_health"
  | "health_connect"
  | "garmin";

export type IntegrationMetric =
  | "steps"
  | "active_energy"
  | "heart_rate"
  | "hrv"
  | "workouts"
  | "routes"
  | "sleep"
  | "weight"
  | "body_fat";

export type NormalizedDailyMetric = {
  kind: "daily_metric";
  provider: IntegrationProvider;
  externalId: string;
  metricDate: string;
  steps?: number | null;
  activeEnergyKcal?: number | null;
  restingHeartRateBpm?: number | null;
  hrvMs?: number | null;
  sourceUpdatedAt?: Date | null;
};

export type NormalizedWorkout = {
  kind: "workout";
  provider: IntegrationProvider;
  externalId: string;
  performedAt: Date;
  durationMin: number;
  activityType: Exclude<ActivityType, "strength" | "mobility">;
  distanceM?: number | null;
  calories?: number | null;
  activeEnergyKcal?: number | null;
  elevationGainM?: number | null;
  title?: string | null;
  route?: {
    externalId?: string | null;
    encodedPolyline?: string | null;
    distanceM?: number | null;
    elevationGainM?: number | null;
  } | null;
  sourceUpdatedAt?: Date | null;
};

export type NormalizedSleep = {
  kind: "sleep";
  provider: IntegrationProvider;
  externalId: string;
  sleepDate: string;
  bedTime: string;
  wakeTime: string;
  durationMin: number;
  stages?: {
    externalId: string;
    stage: "awake" | "light" | "deep" | "rem" | "core";
    startedAt: Date;
    endedAt: Date;
  }[];
  sourceUpdatedAt?: Date | null;
};

export type NormalizedProgress = {
  kind: "progress";
  provider: IntegrationProvider;
  externalId: string;
  entryDate: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  sourceUpdatedAt?: Date | null;
};

export type NormalizedSample = NormalizedDailyMetric | NormalizedWorkout | NormalizedSleep | NormalizedProgress;

export type ProviderAdapter = {
  provider: IntegrationProvider;
  label: string;
  availability: "web_oauth" | "native" | "approval_required" | "planned";
  metrics: IntegrationMetric[];
  defaultScopes: string[];
  getAuthorizationUrl?: (state: string, redirectUri: string) => string;
  exchangeCode?: (code: string, redirectUri: string) => Promise<{
    providerAccountId?: string | null;
    displayName?: string | null;
    scopes: string[];
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  }>;
  fetchBackfill?: (input: { accessToken: string; since: Date; cursor?: string | null }) => Promise<{
    samples: NormalizedSample[];
    nextCursor?: string | null;
  }>;
  normalizeWebhook?: (payload: unknown) => NormalizedSample[];
};

export function workoutEntryFromSample(sample: NormalizedWorkout, exerciseId?: string | null): CardioLogEntry {
  return {
    kind: "cardio",
    activityType: sample.activityType,
    exerciseId: exerciseId ?? null,
    durationMin: sample.durationMin,
    distanceM: sample.distanceM ?? null,
    calories: sample.calories ?? sample.activeEnergyKcal ?? null,
    notes: sample.title ? `Imported from ${sample.provider}: ${sample.title}` : `Imported from ${sample.provider}`,
  };
}
