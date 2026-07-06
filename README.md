# MacroVerse

A community-driven macro tracking, recipe, meal prep, restaurant, and workout platform — MyFitnessPal's data layer with Strava's social graph and Reddit's content ranking, minus the AI prompt box. The community is the content engine: users discover, share, vote on, save, log, and discuss recipes, meal preps, restaurant orders, and workouts created by other users.

**Status:** Stable production app at [macroverse.vercel.app](https://macroverse.vercel.app). All 8 dev phases (0–7) are built: auth (+ guest mode), onboarding, macro tracker, community recipes (+ personal ingredient library), social feed, profiles, restaurants ("Around me" map/list, build-a-bowl, go-to orders), progress dashboard + habits (+ no-scale mode), workouts (logger with PR detection, community workouts, templates), grocery lists, meal prep plans, groups, auto-scored challenges, the moderation stack (reports → admin queue → audit log, rate limits, content warnings), Playwright e2e on the critical flows, and PWA installability with an offline shell. Extended tracking from [docs/10](docs/10-health-integrations-and-tracking.md) is in: micronutrients with %DV on the diary, barcode scanning (camera or typed digits → Open Food Facts), a fasting timer, and manual sleep logging. Admin tools live at `/admin/reports` and `/admin/imports` (admin@macromap.app / password123). Full design in [`docs/`](docs/); deployment guide in [docs/09-deployment.md](docs/09-deployment.md).

## Run it

```bash
npm install
npm run db:setup   # push schema + seed demo data (embedded Postgres via PGlite — no DB install needed)
npm run dev        # http://localhost:3000
```

Demo login: **demo@macromap.app** / **password123** (pre-onboarded, follows the seeded creators, has a logged diary). Or register a fresh account to walk the onboarding wizard.

Dev database lives in `./.data/pglite` (gitignored). To reset: delete `.data/` and rerun `npm run db:setup`. Setting `DATABASE_URL` switches to hosted Postgres automatically ([src/db/client.ts](src/db/client.ts), [docs/09-deployment.md](docs/09-deployment.md)).

Email verification logs links to the dev console unless `RESEND_API_KEY` is set. Google sign-in needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_APP_URL`; register the callback URL as `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`.

To deploy: against `DATABASE_URL`, push the schema (`npm run db:push`) and bootstrap reference data (`npm run db:seed:reference` — foods, restaurants, exercises, workout templates; insert-only, no demo accounts), then register in the app and run `npm run make-admin -- you@example.com`. A `Dockerfile` is included for container hosts; Vercel needs no config beyond the env var. Full walkthrough in [docs/09-deployment.md](docs/09-deployment.md).

E2E tests (Playwright against the dev server — start `npm run dev` first, or let the config spawn one):

```bash
npm run test:e2e
```

Note: PGlite allows one process on the data dir — don't run `npm run build` while the dev server is up (it corrupts `.next`), and expect harmless WASM warnings during builds (parallel build workers touching PGlite; absent with `DATABASE_URL`).

## Design documents

| Doc | Contents |
|---|---|
| [01-prd.md](docs/01-prd.md) | Product requirements: pitch, principles, personas, journeys, feature areas, non-goals, metrics, risks |
| [02-architecture.md](docs/02-architecture.md) | Tech stack, service-layer architecture, versioned REST API, feed strategy, media pipeline, security/privacy, scaling path |
| [03-database-schema.md](docs/03-database-schema.md) | Complete PostgreSQL schema (~45 tables) with rationale |
| [04-screens.md](docs/04-screens.md) | Screen-by-screen UI plan for all 27 screens |
| [05-social-graph-and-profiles.md](docs/05-social-graph-and-profiles.md) | Follow vs. friendship model, feed composition, post/interaction model, profile & privacy design, groups, challenges, accountability |
| [06-recipes-voting-reputation.md](docs/06-recipes-voting-reputation.md) | Recipe lifecycle, macro provenance & confidence, corrections, forking, ranking formulas, restaurant system, reputation & badges |
| [07-moderation.md](docs/07-moderation.md) | Roles, report pipeline, content policy, ED-sensitive design, rate limits, admin panel |
| [08-mvp-roadmap-phases.md](docs/08-mvp-roadmap-phases.md) | MVP scope, roadmap, monetization, 6-phase build plan, full module/file layout, anti-bloat rules |
| [09-deployment.md](docs/09-deployment.md) | Deploying the app + Postgres backend; adding Google/Apple OAuth |
| [10-health-integrations-and-tracking.md](docs/10-health-integrations-and-tracking.md) | Planned: micronutrients, barcode scanning, fasting timer, sleep tracking, wearable/health-platform sync |
| [11-health-integrations-handoff.md](docs/11-health-integrations-handoff.md) | Handoff for continuing health device/app integrations: implemented foundation, scaffolding, gaps, and next steps |
| [12-auth-email-google-oauth-plan.md](docs/12-auth-email-google-oauth-plan.md) | Email verification and Google OAuth plan |

## The three ideas everything hangs on

1. **One social primitive** — votes, saves, reactions, comments, reports, and tags are single polymorphic systems shared by every content type. New content types are cheap; new systems are expensive.
2. **Everything discoverable is loggable** — recipes, menu items, and meal preps all flow into one `food_logs` snapshot path. Discovery always ends in action.
3. **Trust is structural** — every nutrition number carries provenance (verified / ingredient-calculated / creator-entered / corrected / estimated) and a confidence score that moves with community evidence.
