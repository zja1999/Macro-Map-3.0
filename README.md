# Macro Map 3.0

A community-driven macro tracking, recipe, meal prep, restaurant, and workout platform — MyFitnessPal's data layer with Strava's social graph and Reddit's content ranking, minus the AI prompt box. The community is the content engine: users discover, share, vote on, save, log, and discuss recipes, meal preps, restaurant orders, and workouts created by other users.

**Status:** Phases 0–3 vertical slice built and running — auth, onboarding, macro tracker, community recipes, social feed, profiles. Full product + technical design lives in [`docs/`](docs/).

## Run it

```bash
npm install
npm run db:setup   # push schema + seed demo data (embedded Postgres via PGlite — no DB install needed)
npm run dev        # http://localhost:3000
```

Demo login: **demo@macromap.app** / **password123** (pre-onboarded, follows the seeded creators, has a logged diary). Or register a fresh account to walk the onboarding wizard.

Dev database lives in `./.data/pglite` (gitignored). To reset: delete `.data/` and rerun `npm run db:setup`. For hosted Postgres later, swap the driver in [src/db/client.ts](src/db/client.ts) — schema and queries are Postgres-native.

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

## The three ideas everything hangs on

1. **One social primitive** — votes, saves, reactions, comments, reports, and tags are single polymorphic systems shared by every content type. New content types are cheap; new systems are expensive.
2. **Everything discoverable is loggable** — recipes, menu items, and meal preps all flow into one `food_logs` snapshot path. Discovery always ends in action.
3. **Trust is structural** — every nutrition number carries provenance (verified / ingredient-calculated / creator-entered / corrected / estimated) and a confidence score that moves with community evidence.
