# Health Integrations Handoff

This is the quick-start handoff for future sessions that need to continue health device, wearable,
and app integrations. It summarizes what is already merged, what has scaffolding but is not live
yet, and what is still only a future idea.

Read this first, then cross-check the source files named below before making changes. The project is
a Next.js 15 App Router app with Drizzle schema in `src/db/schema.ts`; current integration work is
merged on `master` in commits `78c1485` and `2886143`.

## Current State

The health integration foundation exists and builds. It is mostly infrastructure, not a fully live
consumer integration.

Implemented user-visible pieces:

- Settings includes a Health integrations card linking to `/settings/integrations`.
- `/settings/integrations` lists providers, connection readiness, account status, last sync, and
  sync/disconnect actions.
- `/progress` includes a private "Synced activity" card reading from `daily_health_metrics`.
- OAuth callback, webhook, and native mobile upload API routes exist under `/api/integrations`.

Implemented backend pieces:

- Provider accounts can be stored in `integration_accounts`.
- Provider tokens are encrypted before storage.
- Sync attempts are logged in `integration_sync_runs`.
- Imported samples are deduped with `external_sample_links`.
- Normalized imported samples can write to `daily_health_metrics`, `workout_logs`,
  `workout_routes`, `sleep_logs`, `sleep_stage_samples`, and `progress_entries`.
- Manual progress/sleep entries are protected from being overwritten by synced summaries.
- Apple Health and Health Connect have a native upload endpoint contract, even though no native app
  exists yet.

Not live yet:

- No provider app credentials are configured in the repo.
- No Strava webhook subscription management exists.
- Strava webhooks verify and receive events, but event payloads do not fetch the changed activity.
- Fitbit only normalizes steps and sleep in the current backfill.
- Token refresh/rotation is not implemented.
- CSV importers for MyFitnessPal, MacroFactor, Cronometer, Lose It, and generic CSV are not built.
- No Expo app exists yet, so Apple Health / Health Connect cannot produce data.

## Important Files

Start here:

- `docs/10-health-integrations-and-tracking.md`: product/roadmap context plus the first
  implementation reference.
- `src/db/schema.ts`: source of truth for tables and typed JSON shapes.
- `src/lib/integrations/types.ts`: normalized sample contracts and provider adapter interface.
- `src/lib/integrations/providers.ts`: provider registry and current Strava/Fitbit adapters.
- `src/lib/integrations/sync.ts`: idempotent application of normalized samples into app tables.
- `src/lib/integrations/crypto.ts`: token encryption/decryption.
- `src/actions/integrations.ts`: connect, disconnect, and manual sync server actions.
- `src/app/(main)/settings/integrations/page.tsx`: integration settings UI.
- `src/app/api/integrations/[provider]/callback/route.ts`: OAuth callback.
- `src/app/api/integrations/[provider]/webhook/route.ts`: webhook verification/receive.
- `src/app/api/integrations/mobile/upload/route.ts`: future Expo app upload endpoint.
- `src/app/(main)/progress/page.tsx`: reads `daily_health_metrics` for the synced activity card.
- `src/lib/queries.ts`: includes `getDailyHealthMetrics`.

## Data Model

`integration_accounts`

- One row per user/provider.
- Stores `provider`, `providerAccountId`, `displayName`, `scopes`, encrypted access/refresh token
  fields, `expiresAt`, `syncSettings`, `lastSyncCursor`, `lastSyncedAt`, `status`, and
  `statusMessage`.
- `syncSettings` currently defaults to `{ metrics: {}, backfillDays: 30 }`.
- `status` currently uses plain text values like `connected`, `disabled`, and `error`.

`integration_sync_runs`

- One row per sync attempt.
- Tracks `accountId`, `userId`, `provider`, `kind`, `status`, start/end timestamps,
  `samplesRead`, `samplesWritten`, and `errorMessage`.
- Current `kind` values are `backfill`, `manual`, `webhook`, and `mobile_upload`.

`external_sample_links`

- Idempotency bridge between provider sample IDs and internal rows.
- Primary key is `(provider, externalId, subjectType)`.
- `subjectId` is text, not UUID, so it can point to UUID-backed rows and composite-key rows like
  `sleep_logs` (`userId:sleepDate`).
- Subject types currently used by the sync service:
  - `daily_health_metric`
  - `workout_log`
  - `workout_route`
  - `sleep_log`
  - `sleep_stage_sample`
  - `progress_entry`

`daily_health_metrics`

- Canonical daily summary table for steps, active energy, resting heart rate, and HRV.
- Indexed by `(userId, metricDate)` and external provider ID.
- Read on `/progress`.

`workout_routes`

- Stores route metadata linked to `workout_logs`.
- Current route payload supports `encodedPolyline`, optional GPX storage key, distance, elevation,
  and privacy fields.
- Defaults to `privacyStatus = "private"` and hides start/end by 400 meters.
- No route display UI exists yet.

`sleep_stage_samples`

- Optional stage detail table for sleep imports.
- Supports stage values by convention: `awake`, `light`, `deep`, `rem`, `core`.
- No stage UI exists yet.

Existing tables extended:

- `progress_entries`: added `source`, `externalProvider`, `externalId`.
- `sleep_logs`: added `externalProvider`, `externalId`, and already had `source`.
- `workout_logs`: added `source`, `externalProvider`, `externalId`.

## Normalized Sample Contracts

All providers should normalize into `NormalizedSample` from `src/lib/integrations/types.ts`.

Supported sample kinds:

- `daily_metric`: steps, active energy, resting HR, HRV by date.
- `workout`: performed timestamp, duration, cardio activity type, optional distance/calories/route.
- `sleep`: wake-date keyed sleep summary with optional sleep stages.
- `progress`: weight/body-fat measurements.

Supported providers in the type union:

- `strava`
- `fitbit`
- `whoop`
- `oura`
- `withings`
- `apple_health`
- `health_connect`
- `garmin`

Adapter shape:

- `provider`
- `label`
- `availability`: `web_oauth`, `native`, `approval_required`, or `planned`
- `metrics`
- `defaultScopes`
- optional `getAuthorizationUrl`
- optional `exchangeCode`
- optional `fetchBackfill`
- optional `normalizeWebhook`

When adding a provider, add it to the union, registry, UI will pick it up automatically from
`providerAdapters`, and implement only the methods that are actually possible for that provider.

## Current Provider Registry

Strava:

- Availability: `web_oauth`.
- Scopes: `read`, `activity:read_all`.
- OAuth URL generation is implemented.
- Token exchange is implemented.
- Backfill calls `/athlete/activities?after=...&per_page=50`.
- Activity normalization maps run/ride/bike/walk/hike/row to MacroVerse cardio activity types.
- Summary polyline imports into `workout_routes`.
- Webhook verification exists, but `normalizeWebhook` currently returns no samples. The next step is
  to fetch the changed activity by ID during webhook handling.

Fitbit:

- Availability: `web_oauth`.
- Scopes: `activity`, `heartrate`, `location`, `profile`, `sleep`, `weight`.
- OAuth URL generation is implemented.
- Token exchange is implemented.
- Backfill currently fetches steps and sleep:
  - `/activities/steps/date/{start}/{today}.json`
  - `/sleep/date/{start}/{today}.json`
- Weight/body fat, workouts, and heart rate are listed as supported metrics but not normalized yet.

WHOOP:

- Availability: `planned`.
- Registry entry only.
- Intended metrics: workouts, sleep, heart rate, HRV.

Oura:

- Availability: `planned`.
- Registry entry only.
- Intended metrics: steps, sleep, heart rate, HRV.

Withings:

- Availability: `planned`.
- Registry entry only.
- Intended metrics: weight, body fat.

Apple Health:

- Availability: `native`.
- Registry entry only plus mobile upload support.
- Needs future Expo React Native app to read HealthKit on-device and POST normalized samples.

Health Connect:

- Availability: `native`.
- Registry entry only plus mobile upload support.
- Needs future Expo React Native app to read Health Connect on Android and POST normalized samples.

Garmin:

- Availability: `approval_required`.
- Registry entry only.
- Do not start until Garmin developer approval path is real.

## Current Sync Behavior

`runIntegrationSync(account, kind, samples?)` is the main entry point.

If `samples` is supplied, it applies those samples directly. This is how mobile upload works and how
webhook payloads can be handled after a provider event is fetched/normalized.

If `samples` is not supplied, it:

- Looks up the provider adapter.
- Decrypts the account access token.
- Uses `syncSettings.backfillDays` or 30 days.
- Calls `adapter.fetchBackfill` if available.
- Applies the resulting normalized samples.

Application rules:

- Daily metrics: update existing linked row, otherwise insert and link.
- Workouts: skip if external sample already linked; insert a freeform `workout_logs` row and
  optional `workout_routes` row.
- Sleep: if a manual sleep row exists for the same `(userId, sleepDate)`, synced sleep is ignored.
  Otherwise insert/upsert the sleep row and any stage samples.
- Progress: if a manual progress row exists for the same day, synced progress is ignored. Otherwise
  insert a provider-sourced row.

Sync status:

- Success updates `integration_sync_runs`, `integration_accounts.lastSyncedAt`, cursor, status, and
  status message.
- Failure records `integration_sync_runs.errorMessage` and sets the account status to `error`.

Important current limitation:

- `runIntegrationSync` does not refresh expired access tokens. Add refresh-token rotation before
  expecting long-lived live connections.

## API Routes

`GET /api/integrations/[provider]/callback`

- Handles OAuth callbacks.
- Requires current session cookie.
- Verifies `mm_oauth_{provider}` state cookie.
- Calls adapter `exchangeCode`.
- Upserts the integration account.
- Redirects back to `/settings/integrations`.

`GET /api/integrations/[provider]/webhook`

- Currently supports Strava verification challenge.
- Requires `STRAVA_WEBHOOK_VERIFY_TOKEN`.

`POST /api/integrations/[provider]/webhook`

- Looks up account by provider and external provider account ID (`owner_id` for Strava style,
  `user_id` fallback).
- Calls `adapter.normalizeWebhook`.
- Runs sync with supplied samples.
- Current Strava implementation receives events but does not fetch activity detail yet.

`POST /api/integrations/mobile/upload`

- Authenticated by current session cookie.
- Accepts only `apple_health` or `health_connect`.
- Upserts an integration account with provider account ID fallback `{provider}:{user.id}`.
- Accepts up to 500 normalized samples per request.
- Supported payload sample kinds: daily metrics, workouts, sleep, progress.
- This route is the backend contract for a future Expo app.

## Environment Variables

Already referenced by code:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `HEALTH_TOKEN_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

Token encryption fallback order:

1. `HEALTH_TOKEN_ENCRYPTION_KEY`
2. `AUTH_SECRET`
3. `DATABASE_URL`
4. development fallback string

Production should set `HEALTH_TOKEN_ENCRYPTION_KEY` explicitly and treat changing it as a token
rotation event, because existing ciphertext will no longer decrypt.

## Privacy Rules Already Reflected

- Imported health data is private by default.
- Route rows default to private.
- Route start/end hiding defaults to 400 meters.
- The UI says sharing creates a draft and never posts automatically.
- Manual entries beat synced summaries for sleep/progress.

Privacy work still needed:

- Route display must actually enforce redaction before any social/profile rendering.
- Data export/delete should include all integration tables.
- Public post creation from imported workouts/routes should be explicit and draft-based.
- Token and webhook errors should avoid exposing sensitive raw provider data.

## What Has Framework But Needs Completion

Strava live sync:

- Register Strava app callback URL:
  `/api/integrations/strava/callback`.
- Configure env vars.
- Add a provider setup/admin action to create/update Strava webhook subscription.
- In webhook POST, for `activity` create/update events, fetch `/activities/{id}` with the account
  token and normalize it with the existing Strava activity normalizer.
- Handle delete/deauthorization events by marking linked imported rows removed/disabled, or at
  minimum recording the event.
- Add token refresh before backfill/webhook fetches.
- Consider Strava rate limits and app review if scaling beyond small beta usage.

Fitbit live sync:

- Register Fitbit callback URL:
  `/api/integrations/fitbit/callback`.
- Configure env vars.
- Add token refresh.
- Expand normalizers for:
  - workouts/activity logs
  - weight/body fat into `progress_entries`
  - resting heart rate and HRV into `daily_health_metrics`
  - sleep stages into `sleep_stage_samples`
- Decide whether to use Fitbit subscriptions/webhooks or scheduled/manual sync first.

Native health bridge:

- Build Expo React Native app, not a thin webview wrapper.
- Add auth/token strategy for mobile. Current mobile upload route uses the web session cookie; native
  clients will likely need bearer-token session support or a login flow that can preserve cookies.
- On iOS, request HealthKit permissions and normalize samples to the mobile upload contract.
- On Android, request Health Connect permissions and normalize samples to the same contract.
- Upload opportunistically; do not promise perfect real-time background sync.

Settings UI:

- It currently exposes connect/sync/disconnect and status.
- Per-metric toggles are represented in `syncSettings.metrics` but not surfaced in the UI.
- Backfill days are represented in `syncSettings.backfillDays` but not editable in the UI.
- Error states exist, but can be made friendlier by mapping provider errors to stable messages.

Progress/workout UI:

- `/progress` shows a simple synced activity summary.
- No workout import review UI exists.
- No route map/card UI exists.
- No sleep stage UI exists.
- Imported workouts land directly in `workout_logs`; there is no user review queue.

Testing:

- `npm run build` passed after the foundation was added.
- There are no dedicated unit tests for provider normalizers or sync idempotency yet.
- Add fixture-based tests for Strava/Fitbit normalizers before expanding provider logic.

## Future Ideas Not Set Up Yet

CSV/app imports:

- MyFitnessPal, MacroFactor, Cronometer, Lose It, and generic CSV importers are roadmap only.
- Existing admin import UI/pipeline can inspire this, but user-owned history import needs separate
  staging, preview, dry-run diff, and commit flows.
- Food history can write macro snapshots directly into `food_logs`; do not require food matching for
  old history.

Provider expansion:

- WHOOP: recovery, strain, sleep, workouts. Useful but product meaning needs care.
- Oura: sleep/readiness/activity/HRV. Good wellness fit, less route value.
- Withings: weight/body composition; likely easiest after Fitbit progress import exists.
- Garmin: high value for endurance users, but vendor approval-gated.

Analytics:

- Premium analytics could use `daily_health_metrics`, workouts, sleep, and food adherence together.
- Avoid ML/personalization until simple explainable analytics are exhausted.
- Potential metrics: step consistency, activity-energy trend, sleep vs adherence, training volume vs
  weight trend, route PRs.

Social:

- Imported workouts/routes should become post drafts, not automatic posts.
- Potential post types later: run route, step milestone, sleep streak, recovery insight.
- Keep the one-social-primitive rule: posts/reactions/comments stay shared systems.

Route/maps:

- Add route map display only after redaction is implemented.
- Use existing map stack principles where possible: free/keyless first, paid API only if quality
  forces it.
- Consider encoded polyline rendering client-side; do not store raw GPS publicly by default.

Data export/delete:

- GDPR-shaped export/delete is a project principle, but integration tables need explicit inclusion.
- Export should include connected provider metadata, sync run history, external sample links, daily
  health metrics, routes, sleep stages, and source columns on existing logs.
- Delete should cascade provider accounts and imported samples as expected.

Jobs/queues:

- No job runner exists yet.
- Manual sync and webhook sync run inline.
- If sync latency or provider retries become real, add a job runner per the architecture docs rather
  than building ad hoc background behavior.

## Suggested Next Implementation Order

1. Add tests around the foundation before expanding it:
   - token encrypt/decrypt
   - Strava activity normalization
   - Fitbit steps/sleep normalization
   - idempotent sample application
   - manual sleep/progress conflict behavior
2. Add token refresh support to the provider adapter interface and `runIntegrationSync`.
3. Finish Strava first:
   - callback/env setup
   - refresh token
   - manual sync
   - webhook fetch activity by ID
   - route map display behind private/redacted status
4. Expand Fitbit:
   - weight/body fat
   - heart rate basics
   - workouts
   - sleep stages
5. Add settings controls for metric toggles and backfill window.
6. Add CSV importers for switcher onboarding.
7. Build the Expo native health bridge for Apple Health / Health Connect.

## Known Cautions

- The architecture docs prefer business logic in `src/services/*`; this repo currently has many
  domain helpers under `src/lib/*` and server actions directly using them. The integration foundation
  follows the current as-built pattern (`src/lib/integrations/*`), but a future service-layer cleanup
  could move this under `src/services/integrations`.
- Existing docs still contain some older mojibake characters from earlier encoding drift. Avoid
  broad formatting rewrites unless asked.
- `external_sample_links.subjectId` is text by design. Do not casually change it back to UUID.
- Imported workouts are freeform `workout_logs` rows with JSON entries; this matches current workout
  storage but means relational workout analytics need extracted summaries later.
- The mobile upload endpoint currently depends on `getCurrentUser`, which reads the web session
  cookie. A real native app needs an auth plan.
- Changing `HEALTH_TOKEN_ENCRYPTION_KEY` invalidates existing encrypted provider tokens unless a
  rotation path is implemented.
- The current webhook route trusts provider-shaped payloads after reaching the route. Add provider
  signature/verification where available before production use.

