# Macro Map — Health Integrations & Extended Tracking

**Status:** §1–4 are built (micronutrients, barcode scanning, fasting timer, manual sleep
logging). §5 wearable sync remains planned. Implementation notes inline per section.

Five roadmap items that came out of a feature-gap review against the major nutrition/workout apps
(MyFitnessPal, Cronometer, Whoop, Strava, MacroFactor): **micronutrients, barcode scanning, a
fasting timer, sleep tracking, and wearable/health-platform sync**. A sixth gap from that review —
AI-generated meal/workout plans — is deliberately **not** here: [01-prd §7](01-prd.md) lists "no AI
meal/workout generation, AI chat, or AI coaching" as a non-goal, and the README's pitch is the
community *instead of* an AI prompt box. Reversing that is a product-identity decision, not a
backlog item, so it's out of scope for this doc.

This extends, rather than replaces, the "Health integrations & data import" sketch in
[08 §2](08-mvp-roadmap-phases.md) — that sketch is right about Apple Health needing the native app;
it's wrong to lump every wearable into that wait, corrected in §5 below.

## 1. Micronutrients

Today `foods`/`recipes`/`menu_items` carry `fiberG` and `sodiumMg` only — no sugar, no
vitamins/minerals ([schema.ts:226-227](../src/db/schema.ts)). The gap is real but small: it's more
nullable columns on tables that already exist, not a new subsystem.

- Add to `foods`, `recipes`, `menu_items`, and the `food_logs` snapshot: `sugarG`, `addedSugarG`,
  `saturatedFatG`, `cholesterolMg`, `potassiumMg`, `calciumMg`, `ironMg`, `vitaminDMcg`,
  `vitaminCMg`, `vitaminAMcg` — all nullable `real()`, same sparse pattern as `fiberG`/`sodiumMg`
  today. A fixed, well-known nutrient set stays columns; it does not earn an EAV table.
- Tracker UI: an expandable "more nutrients" panel on the diary (collapsed by default — the 80/20
  screens stay uncluttered per [08 §5.8](08-mvp-roadmap-phases.md)), plus micronutrient rows on the
  weekly-averages view.
- Provenance: these ride the existing `macroSource`/`macroConfidence` fields — a food missing
  micronutrient data isn't an error state, it's just null, same as today's optional fields.
- Admin CSV import ([07 §6](07-moderation.md)) gains the new columns as optional mapped fields.

**Phase:** roadmap Phase 2 — pure schema + UI extension of an already-built vertical, no external
dependency, no new risk.

> **Built.** Columns live on `foods`/`recipes`/`menu_items`/`food_logs` (shared `microColumns()`
> helper in [schema.ts](../src/db/schema.ts)); all log paths snapshot them; the diary shows a
> collapsed "More nutrients" panel ([lib/nutrients.ts](../src/lib/nutrients.ts) holds the FDA DVs).
> Nutrients no logged item carries render as "—", never a fake 0. Seed foods carry
> fiber/sugar/sat-fat/sodium; vitamins arrive via barcode imports. Recipe-form ingredient
> roll-up of micros and the admin CSV columns are still open (seed recipes do roll up).

## 2. Barcode scanning

Client-side barcode decode (`@zxing/browser` or similar, `getUserMedia` camera access — works in
mobile web, no native app required) against **Open Food Facts** (free, keyless, huge open barcode
database — fits the "free where possible" principle already used for Nominatim/Overpass in
[08 §1c](08-mvp-roadmap-phases.md)).

- Scan → barcode lookup in Open Food Facts → if found, insert into `foods` with
  `source='off_import'`, `verified=false` (community can upvote/correct like any user-submitted
  food) → falls into the normal Add Food flow already built.
- Not found in Open Food Facts → falls back to the existing manual "create a food" form.
- No new interaction system: it's a faster way to reach the same `foods` insert + `food_logs`
  path that recipes, menu items, and manual entries already use ([08 §5.3](08-mvp-roadmap-phases.md)).

**Photo-based food recognition** (point a camera at a plate, get a macro estimate) is a different
and much more expensive proposition — a vision-model call per scan, real accuracy risk, no free
tier. It's a data-entry accelerant like barcode scanning (not content generation, so it doesn't
touch the AI non-goal above), but it's parked, not scheduled: revisit only if barcode + manual
entry friction shows up in retention data, same deferral discipline as Redis/search engine in
[02 §9](02-architecture.md).

**Phase:** roadmap Phase 2 (barcode only) — client-side + one free API call, no OAuth, no native app.

> **Built.** "📷 Scan" tab on Add Food: `@zxing/browser` camera decode with manual digit entry as
> the always-works fallback ([BarcodeScanner.tsx](../src/components/BarcodeScanner.tsx));
> [actions/barcode.ts](../src/actions/barcode.ts) resolves via OFF v2, inserts a `foods` row
> (per-100 g, `source='off_import'`, unverified, micros mapped with g→mg/mcg conversions) and
> redirects into the normal search-and-log flow. Re-scans of a known barcode skip the API.

## 3. Fasting timer

A `fasting_windows` table: `userId`, `startedAt`, `endedAt` (nullable while active), `targetHours`.
Start/stop control on the tracker screen; a live "3h42m into your 16h fast" readout while active.
Streaks compute the same way the existing habit streaks do ([08 §1b](08-mvp-roadmap-phases.md)) —
no new streak engine, just another `*_logs`-shaped table feeding the same computation.

**Phase:** roadmap Phase 2 — same size and shape as the habits tracker that's already built.

> **Built.** `fasting_windows` table; start/end/discard actions; live-elapsed card on the tracker
> (today only), progress bar against target, last-completed line when idle.

## 4. Sleep tracking

Two tiers, shippable independently:

- **Manual entry** (no dependency): a `sleep_logs` table (`userId`, `sleepDate`, `bedAt`, `wokeAt`,
  `qualityRating` 1-5 optional), surfaced on the progress dashboard next to habits — same pattern
  as `progress_entries`/`habit_logs`. Cheap, ships without waiting on any integration.
- **Auto-synced** (via wearable/health-platform integration, §5): duration and sleep stages land in
  the same `sleep_logs` rows, `source` column distinguishing `manual` vs the provider.

**Phase:** manual entry — Phase 2 (no dependency, ships now). Synced sleep — bundled with whichever
wearable integration lands it (§5).

> **Built** (manual tier). Implementation refinement over the sketch above: times are stored as
> local `"HH:MM"` strings + a computed `durationMin` (bed ≥ wake ⇒ overnight, +24 h) instead of
> timestamps — no timezone round-trip for a web form. `source` column is ready for §5 providers.
> Card on /progress: log form, last-7 nights with duration bars, quality, running average.

## 5. Wearable & health-platform sync

[08 §2](08-mvp-roadmap-phases.md) currently frames *all* of this as Phase 4, gated on the native
mobile app, with the reasoning "HealthKit has no web API." That's true for **Apple HealthKit**
specifically (and, as of the Health Connect migration, Google Fit's REST API is deprecated in favor
of an Android on-device API) — both genuinely need a native app. But it's not true for the others:

| Provider | API shape | Needs native app? |
|---|---|---|
| Apple Health (HealthKit) | On-device only, no web API | **Yes** — blocked on the mobile app |
| Google Fit / Health Connect | Migrated to an Android on-device API (REST API deprecated) | **Yes** — same blocker |
| **Fitbit** | Public OAuth2 REST API | **No** — usable from the web app today |
| **Whoop** | Public OAuth2 REST API (v1) | **No** — usable from the web app today |
| **Strava** | Public OAuth2 REST API | **No** — usable from the web app today |
| **Garmin** | Garmin Connect Health API (OAuth2, application-gated approval) | **No**, but needs Garmin's developer approval before launch |

So the design: build one `integration_accounts` table (`userId`, `provider`, `scopes`, `accessToken`,
`refreshToken`, `expiresAt`, `providerAccountId`, `lastSyncCursor`) and one sync-service interface
(per-provider adapter implementing `fetchNewSamples(cursor)` → normalized rows), exactly as
[08 §2](08-mvp-roadmap-phases.md) already sketched — but split the rollout:

- **Sooner (roadmap Phase 3, not Phase 4):** Fitbit, Whoop, Strava via OAuth2 from the web app.
  Read: weight/body-fat → `progress_entries`; steps → challenges + progress; workouts/active energy
  → `workout_logs`; sleep → `sleep_logs` (§4). Write-out (logged nutrition/workouts back to the
  provider) follows once read-sync is stable.
- **Later (roadmap Phase 4, tied to the mobile app):** Apple HealthKit, Google Health Connect,
  Garmin (pending their approval process) — same `integration_accounts` shape and sync-service
  interface, just a native-side adapter instead of an OAuth redirect.

Conflict rule unchanged from the original sketch: idempotent upserts keyed by provider sample id,
"most-specific-source wins" (manual entry beats synced) on any given metric/day.

## 6. Summary: phase placement

| Feature | Phase | Why here |
|---|---|---|
| Micronutrients | 2 | Schema + UI only, no dependency |
| Fasting timer | 2 | Same shape as the built habits tracker |
| Barcode scanning | 2 | Client-side + one free keyless API |
| Manual sleep logging | 2 | Same shape as progress entries |
| Fitbit / Whoop / Strava sync | 3 | Web-OAuth APIs, no native app needed — moved up from Phase 4 |
| Apple Health / Google Health Connect / Garmin | 4 | Genuinely blocked on the native app (or, for Garmin, vendor approval) |
| AI-generated meal/workout plans | — | Explicit PRD non-goal; not scheduled |
| Photo-based food recognition | — | Parked; revisit only if barcode+manual friction data demands it |
