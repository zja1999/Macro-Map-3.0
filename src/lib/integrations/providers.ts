import type { IntegrationProvider, NormalizedSample, NormalizedWorkout, ProviderAdapter } from "./types";

const STRAVA_SCOPES = ["read", "activity:read_all"];
const FITBIT_SCOPES = ["activity", "heartrate", "location", "profile", "sleep", "weight"];

function env(name: string) {
  return process.env[name] || "";
}

function asIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function minutes(start: string | Date, end: string | Date) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function stravaActivityType(type: string): NormalizedWorkout["activityType"] | null {
  const normalized = type.toLowerCase();
  if (normalized.includes("run")) return "outdoor_run";
  if (normalized.includes("ride") || normalized.includes("bike")) return "outdoor_bike";
  if (normalized.includes("walk")) return "walk";
  if (normalized.includes("hike")) return "hike";
  if (normalized.includes("row")) return "rowing";
  return null;
}

function normalizeStravaActivity(activity: Record<string, unknown>): NormalizedWorkout | null {
  const activityType = stravaActivityType(String(activity.type ?? activity.sport_type ?? ""));
  const id = String(activity.id ?? "");
  const startedAt = activity.start_date ? new Date(String(activity.start_date)) : null;
  const durationSec = Number(activity.moving_time ?? activity.elapsed_time ?? 0);
  if (!id || !activityType || !startedAt || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const distanceM = Number(activity.distance ?? 0);
  const elevationGainM = Number(activity.total_elevation_gain ?? 0);
  const polyline = (activity.map as { summary_polyline?: string } | undefined)?.summary_polyline ?? null;
  return {
    kind: "workout",
    provider: "strava",
    externalId: id,
    performedAt: startedAt,
    durationMin: Math.max(1, Math.round(durationSec / 60)),
    activityType,
    distanceM: Number.isFinite(distanceM) && distanceM > 0 ? distanceM : null,
    elevationGainM: Number.isFinite(elevationGainM) && elevationGainM > 0 ? elevationGainM : null,
    title: String(activity.name ?? "Strava activity"),
    route: polyline
      ? {
          externalId: `${id}:route`,
          encodedPolyline: polyline,
          distanceM: Number.isFinite(distanceM) && distanceM > 0 ? distanceM : null,
          elevationGainM: Number.isFinite(elevationGainM) && elevationGainM > 0 ? elevationGainM : null,
        }
      : null,
    sourceUpdatedAt: activity.updated_at ? new Date(String(activity.updated_at)) : null,
  };
}

async function stravaJson(path: string, accessToken: string) {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava request failed (${res.status})`);
  return res.json();
}

async function fitbitJson(path: string, accessToken: string) {
  const res = await fetch(`https://api.fitbit.com/1/user/-${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Fitbit request failed (${res.status})`);
  return res.json();
}

export const providerAdapters: Record<IntegrationProvider, ProviderAdapter> = {
  strava: {
    provider: "strava",
    label: "Strava",
    availability: "web_oauth",
    metrics: ["workouts", "routes"],
    defaultScopes: STRAVA_SCOPES,
    getAuthorizationUrl(state, redirectUri) {
      const clientId = env("STRAVA_CLIENT_ID");
      if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
      const url = new URL("https://www.strava.com/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("approval_prompt", "auto");
      url.searchParams.set("scope", STRAVA_SCOPES.join(","));
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeCode(code, redirectUri) {
      const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: env("STRAVA_CLIENT_ID"),
          client_secret: env("STRAVA_CLIENT_SECRET"),
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        scope?: string;
        athlete?: { id?: number; username?: string; firstname?: string; lastname?: string };
      };
      const athlete = data.athlete;
      return {
        providerAccountId: athlete?.id != null ? String(athlete.id) : null,
        displayName: athlete?.username || [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ") || "Strava athlete",
        scopes: data.scope ? data.scope.split(",") : STRAVA_SCOPES,
        accessToken: data.access_token ?? null,
        refreshToken: data.refresh_token ?? null,
        expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      };
    },
    async fetchBackfill({ accessToken, since }) {
      const after = Math.floor(since.getTime() / 1000);
      const activities = (await stravaJson(`/athlete/activities?after=${after}&per_page=50`, accessToken)) as Record<string, unknown>[];
      return { samples: activities.map(normalizeStravaActivity).filter((sample): sample is NormalizedWorkout => !!sample) };
    },
    normalizeWebhook(payload) {
      const event = payload as { object_type?: string; object_id?: number; aspect_type?: string };
      if (event.object_type !== "activity" || event.aspect_type === "delete" || !event.object_id) return [];
      return [];
    },
  },
  fitbit: {
    provider: "fitbit",
    label: "Fitbit",
    availability: "web_oauth",
    metrics: ["steps", "sleep", "weight", "body_fat", "workouts", "heart_rate"],
    defaultScopes: FITBIT_SCOPES,
    getAuthorizationUrl(state, redirectUri) {
      const clientId = env("FITBIT_CLIENT_ID");
      if (!clientId) throw new Error("FITBIT_CLIENT_ID is not configured");
      const url = new URL("https://www.fitbit.com/oauth2/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", FITBIT_SCOPES.join(" "));
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeCode(code, redirectUri) {
      const clientId = env("FITBIT_CLIENT_ID");
      const secret = env("FITBIT_CLIENT_SECRET");
      const res = await fetch("https://api.fitbit.com/oauth2/token", {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
      });
      if (!res.ok) throw new Error(`Fitbit token exchange failed (${res.status})`);
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        user_id?: string;
      };
      return {
        providerAccountId: data.user_id ?? null,
        displayName: "Fitbit",
        scopes: data.scope ? data.scope.split(" ") : FITBIT_SCOPES,
        accessToken: data.access_token ?? null,
        refreshToken: data.refresh_token ?? null,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      };
    },
    async fetchBackfill({ accessToken, since }) {
      const today = asIsoDate(new Date());
      const start = asIsoDate(since);
      const [steps, sleep] = await Promise.all([
        fitbitJson(`/activities/steps/date/${start}/${today}.json`, accessToken),
        fitbitJson(`/sleep/date/${start}/${today}.json`, accessToken),
      ]);
      const samples: NormalizedSample[] = [];
      for (const row of (steps as { "activities-steps"?: { dateTime: string; value: string }[] })["activities-steps"] ?? []) {
        samples.push({
          kind: "daily_metric",
          provider: "fitbit",
          externalId: `steps:${row.dateTime}`,
          metricDate: row.dateTime,
          steps: Number(row.value),
        });
      }
      for (const row of (sleep as { sleep?: Record<string, unknown>[] }).sleep ?? []) {
        const startTime = String(row.startTime ?? "");
        const endTime = String(row.endTime ?? "");
        if (!startTime || !endTime) continue;
        samples.push({
          kind: "sleep",
          provider: "fitbit",
          externalId: String(row.logId ?? `sleep:${startTime}`),
          sleepDate: String(row.dateOfSleep ?? asIsoDate(new Date(endTime))),
          bedTime: startTime.slice(11, 16),
          wakeTime: endTime.slice(11, 16),
          durationMin: minutes(startTime, endTime),
        });
      }
      return { samples };
    },
  },
  whoop: { provider: "whoop", label: "WHOOP", availability: "planned", metrics: ["workouts", "sleep", "heart_rate", "hrv"], defaultScopes: [] },
  oura: { provider: "oura", label: "Oura", availability: "planned", metrics: ["steps", "sleep", "heart_rate", "hrv"], defaultScopes: [] },
  withings: { provider: "withings", label: "Withings", availability: "planned", metrics: ["weight", "body_fat"], defaultScopes: [] },
  apple_health: { provider: "apple_health", label: "Apple Health", availability: "native", metrics: ["steps", "active_energy", "workouts", "routes", "sleep", "weight", "heart_rate", "hrv"], defaultScopes: [] },
  health_connect: { provider: "health_connect", label: "Health Connect", availability: "native", metrics: ["steps", "active_energy", "workouts", "sleep", "weight", "heart_rate", "hrv"], defaultScopes: [] },
  garmin: { provider: "garmin", label: "Garmin", availability: "approval_required", metrics: ["steps", "active_energy", "workouts", "routes", "sleep", "heart_rate"], defaultScopes: [] },
};

export function getProviderAdapter(provider: string): ProviderAdapter | null {
  return provider in providerAdapters ? providerAdapters[provider as IntegrationProvider] : null;
}

export function configuredForOAuth(provider: IntegrationProvider) {
  if (provider === "strava") return Boolean(env("STRAVA_CLIENT_ID") && env("STRAVA_CLIENT_SECRET"));
  if (provider === "fitbit") return Boolean(env("FITBIT_CLIENT_ID") && env("FITBIT_CLIENT_SECRET"));
  return false;
}
