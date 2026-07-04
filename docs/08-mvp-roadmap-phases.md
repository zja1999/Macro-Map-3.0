# Macro Map — MVP, Roadmap, Development Phases, Module Layout & Simplicity Rules

## 1. MVP feature list

The MVP is one sentence: **track your macros, and everything you can discover you can log.**

| Included | Notes |
|---|---|
| Accounts + onboarding | All 7 tracking styles; calculated targets + manual override; **guest mode** (anonymous session, full functionality, "claim your account" prompt later — see §1a) |
| Profiles + privacy matrix | Opt-in modules present but minimal styling |
| Follow + friend requests + block | No DMs |
| Home feed (Following/Friends/Trending) + posts + comments + reactions | All post types that don't depend on unbuilt systems |
| Recipe submission, detail, discovery, votes, saves, ratings, tried, **log-to-diary** | Ingredient-linked macro calculation; provenance badges; corrections = simple report-to-creator flow (voting on corrections is phase 2); **personal ingredient library** for fast repeat recipe-building (§1b) |
| Macro tracker | kcal/P/C/F/fiber/sugar/sodium/water, barcode scan, saved meals, copy day/meal, weekly averages, adherence, streaks; **favorites ("my usual") distinct from auto-tracked frequents** (§1b) |
| Restaurant DB + optimizer | Admin-imported top chains; **interactive map** (Leaflet + OpenStreetMap tiles, free/keyless — §1c) with radius control and map/list toggle; **"Around me" concatenated cross-chain item list ranked against remaining macros** as the default view; **item builder ("build a bowl") for build-line chains** (Chipotle, Subway, Cava…) with live macro tally, log, and save-as-go-to-order; **combo-meal recommendation** (entree+side scored as a pairing); per-chain browse + item rankings. See [06 §7a–7c](06-recipes-voting-reputation.md) |
| Progress tracking | Weight/measurements/photos (private), charts, milestone share prompts, **habits tracker** (protein goal / water / move / veggies, each with its own streak) — see §1b |
| Workout logging + community workouts | Logger with PR detection; publish/save/complete/fork workouts; template shelf |
| Groups + challenges | Public groups; auto-scored challenge metrics + custom check-in |
| Grocery lists from recipes/preps | Dedupe + sections + cost estimate |
| Meal prep plans | Compose from recipes; boards as saved filters |
| Admin: reports queue, user management, macro verification, CSV import | The minimum to run a UGC platform safely; **upload history/changelog + duplicate detection** (§1d) |
| User feedback | Always-available "send feedback" affordance, rate-limited, admin-reviewed — separate from content moderation reports (§1d) |
| Notifications (in-app inbox only) | No push/email in MVP |

**Explicitly out of MVP:** DMs, grocery-list sharing, correction voting, restaurant-request voting, pantry, coach mode, monetization, wearables, push notifications, PDF auto-extraction, dedicated search engine, native apps, full offline/local-first storage (see §1a).

### 1a. Guest mode (not full local-first)

Considered and rejected: a fully local-first architecture (on-device store as source of truth, account as optional sync layer with conflict merge). That's a separate subsystem — local DB, sync protocol, merge rules retrofitted into every service — disproportionate to the actual goal, which is removing the signup wall, not offline support. Instead: an anonymous session (same cookie/session mechanism as [02 §7](02-architecture.md), no email/password) is created on first visit, so onboarding, tracking, and recipe-building all work with zero signup. Data still lives in the one Postgres backend. A persistent "save your progress" prompt offers to attach email/password to the existing anonymous `users` row (no data migration — same row gets a password_hash and becomes a normal account). Cross-device access requires that claim step, same as before. Revisit true offline/local-first only if guest-mode adoption data says the friction is elsewhere.

### 1b. Personal ingredient library, favorites/frequents, habits

- **Personal ingredient library** — additive to the shared, community-verified `foods` table, not a replacement. A private `personal_ingredients` table ([03 schema](03-database-schema.md)) holds freeform ingredients a user enters once (name + quantity/unit + macros for that quantity) while building a recipe; the recipe form searches both `foods` and the user's own library, so "chicken breast, 6oz" is one tap the second time. Personal ingredients carry no community confidence score and aren't visible to anyone else — they're a speed tool, not a submission.
- **Favorites vs. frequents** — `saves` (already the shared save primitive) is the user-curated "my usual" pin, available on any menu item, recipe, or go-to order for instant re-logging. **Frequents** is a separate, non-curated computed view (`GROUP BY` over recent `food_logs`, no new table) surfaced as quick-add shortcuts on the Add Food screen. Different UI slot, same underlying save/log primitives — no new interaction system.
- **Habits tracker** — a small `habits` + `habit_logs` pair ([03 schema](03-database-schema.md)): a default set (hit protein goal, drink water, move/exercise, eat veggies) each with its own streak, computed the same way the existing logging streak already is. Lives on the progress dashboard, not the social feed.

### 1c. Mapping & geocoding

Free and keyless throughout, per the "free where possible" principle: **Leaflet** for the map view + **OpenStreetMap** tiles + **Nominatim** for geocoding (address/city search) and reverse geocoding, and the **Overpass API** for nearby-chain POI lookup as a first pass (swap to a paid places API later only if data quality demands it — the seam is one query module, not the whole restaurants vertical).

### 1d. Resilience & admin data pipeline

- **Fallback dataset**: if the nutrition backend/DB is ever unreachable, the app serves a small bundled seed dataset (a static JSON snapshot of the seeded foods + top chains) instead of a hard error, so a backend outage degrades the tracker to "search a smaller offline list" rather than bricking it.
- **Admin CSV/Excel upload** ([07-moderation §6](07-moderation.md)) gets real validation teeth: required-field + numeric-sanity checks, duplicate detection against both the file itself and existing `foods`/`menu_items` rows, and an upload-history/changelog table so a bad import is auditable and reversible.

## 2. Future roadmap

*Numbering note: the phases below are post-launch roadmap phases, independent from the §3 development phases (0–7) that got MVP built. "Roadmap Phase 2" ≠ "Dev Phase 2."*

**Phase 2 — deepen the loops (post-launch quarter):** DMs + friend accountability nudges · correction voting + community-mod role · restaurant request voting + community item submission at scale · grocery list sharing · progress photo timeline compare/export · push + email notifications (same `notifications` rows) · repost/share-with-comment.

**Phase 3 — ecosystem:** coach mode (client roster, shared logs with consent, check-in reviews) · creator pages + verified creators · advanced groups (private content collections) · advanced challenge types + sponsored challenges · pantry tracking ("what can I prep with what I have") · premium analytics.

**Phase 4 — platform:** mobile apps (React Native/Expo against `/api/v1`) · health-platform sync and app-data import (below) · local events + gym communities · dedicated search · monetization rollout.

### Health integrations & data import (planned design)

**Apple Health / Google Fit** (requires the native app — HealthKit has no web API; this is a headline reason the mobile app exists):
- *Read into MacroMap:* weight & body-fat (→ `progress_entries`, auto-filling weigh-ins), steps (→ challenges + progress), workouts & active energy (→ `workout_logs`), sleep (→ progress).
- *Write out:* logged nutrition (calories/macros) and workouts, so MacroMap plays nicely as the source of truth in the user's health graph.
- Sync model: an `integration_accounts` table (provider, scopes, tokens/anchors) + idempotent upserts keyed by provider sample id; conflicts resolve "most-specific-source wins" (manual entry beats synced).
- Same table/pattern extends to **Strava/Garmin** (OAuth, workout import) and **smart scales** later.

**Import from other tracking apps** (earlier — Phase 2–3, no native app needed, big switching-cost killer):
- File importers for **MyFitnessPal, MacroFactor, Cronometer, Lose It** CSV exports, plus a generic CSV mapper: upload → staging table → column mapping preview (reusing the admin nutrition-import wizard UI) → dry-run diff → commit into `food_logs` (as macro snapshots — no food matching required for history) and `progress_entries` (weight).
- Imported history is flagged `source='import:mfp'` so analytics can distinguish it; streaks/adherence recompute over it, so a switcher lands with their trend charts intact on day one.
- Export symmetrically: full CSV export of logs/progress already committed in the GDPR-shaped data-export requirement ([02 §7](02-architecture.md)).

**Monetization (when the community is real, not before):** freemium core (tracking + community forever free — the community *is* the moat; paywalling contribution kills it). Premium ($/mo): advanced analytics (trend modeling, adherence forecasting), calorie banking+, unlimited saved meals/lists, ad-free. Creator subscriptions (premium recipe packs/programs, revenue share). Coach tools (per-client pricing). Team/gym plans. Sponsored challenges + restaurant partnerships (clearly labeled). Grocery affiliate links on grocery lists. **Never sell:** ranking placement, health data.

## 3. Development phases (solo-dev-with-Claude sized)

Phases 0–3 are **built** (see [README](../README.md) for the running vertical slice). Phases 4+ are reordered from the original plan: restaurants/map/builder and progress/habits move ahead of workouts and groups, because they're the summary golden path's actual core loop (nearby recommendation + build-a-plate), whereas workouts/groups/challenges are additive social surface that can follow. Social (Phase 3) is intentionally not undone — it ships alongside, not instead of, the utility loop.

| Phase | Scope | Exit criterion |
|---|---|---|
| ~~**0. Foundation**~~ ✅ built | Next.js + Drizzle + PGlite, schema migrated, seed scripts, design tokens + core components | Sign up → onboard → see targets |
| ~~**1. Tracker**~~ ✅ built | Food search/log, tracker screen, copy ops, streaks/adherence | A user can track a full week |
| ~~**2. Recipes**~~ ✅ built | Recipe CRUD + ingredients + provenance, discovery + filters, votes/saves/ratings/tried, log-recipe | Discover → save → log loop works |
| ~~**3. Social**~~ ✅ built | Profiles, follow/block, posts/comments/reactions, home feed | Two accounts can fully interact |
| **4. Restaurants + map + progress** (next) | Guest mode; Leaflet/OSM/Nominatim map + "Around me" ranked cross-chain list; buildable-item plate builder + combo-meal recommendation; go-to orders; progress dashboard (weight/measurements/photos) + habits tracker; personal ingredient library; favorites/frequents split on Add Food; admin CSV import with validation/changelog; feedback mechanism; fallback dataset | Open the app near a real address, get a ranked nearby recommendation, build and log a bowl, see it reflected in progress |
| **5. Workouts** | Workout logger + PRs, community workouts, templates, grocery lists, meal prep plans | Both remaining loggable content verticals live |
| **6. Community + safety** | Groups, challenges + auto-scoring, reports + admin dashboard, rate limits, content warnings | Safe to open to strangers |
| **7. Beta hardening** | Playwright on critical flows, perf pass, PWA installability + offline shell for previously-loaded content, seed content push, copy/ED-safety review | Public beta |

Each phase ships behind nothing — the app has been deployable and self-usable since Phase 1. That ordering was deliberate for what's already built: the tracker had to be excellent *before* social, because the social layer's currency (logs, adherence, PRs) is minted by the tracker. Phase 4 reprioritizes forward from here based on where the actual golden path leads.

## 4. Files / modules to create

```
macro-map/
├─ drizzle/                        # migrations
├─ scripts/seed/                   # usda-foods.ts, exercises.ts, tags.ts, chains.ts, demo-content.ts
├─ src/
│  ├─ db/
│  │  ├─ schema/                   # one file per domain: users.ts, social.ts, recipes.ts,
│  │  │                            #   logging.ts, restaurants.ts, workouts.ts, progress.ts,
│  │  │                            #   groups.ts, moderation.ts, notifications.ts
│  │  └─ client.ts
│  ├─ services/                    # ALL business logic (see architecture §2)
│  │  ├─ auth.ts        onboarding.ts   targets.ts      # TDEE calc, floors, overrides
│  │  ├─ feed.ts        posts.ts        interactions.ts # reactions/votes/saves/comments (polymorphic)
│  │  ├─ recipes.ts     corrections.ts  ranking.ts      # hot/quality/wilson + cron entrypoints
│  │  ├─ foods.ts       logging.ts      streaks.ts      adherence.ts
│  │  ├─ mealPreps.ts   groceries.ts    mealPlans.ts
│  │  ├─ restaurants.ts menuItems.ts    orders.ts
│  │  ├─ workouts.ts    workoutLogs.ts  prs.ts          exercises.ts
│  │  ├─ progress.ts    profiles.ts     privacy.ts      # canView + serializeProfile (the only gate)
│  │  ├─ social.ts                                       # follows, friendships, blocks
│  │  ├─ groups.ts      challenges.ts
│  │  ├─ reputation.ts  badges.ts
│  │  ├─ moderation.ts  reports.ts
│  │  ├─ notifications.ts media.ts      search.ts       imports.ts  # CSV import
│  ├─ app/
│  │  ├─ (auth)/login, register, onboarding/
│  │  ├─ (main)/                   # shell with tab bar
│  │  │  ├─ page.tsx (feed)  discover/  recipes/ [id]/ new/
│  │  │  ├─ meal-prep/  track/  restaurants/  menu-items/
│  │  │  ├─ workouts/ log/ new/ [id]/
│  │  │  ├─ u/[username]/  friends/  groups/  challenges/
│  │  │  ├─ progress/  groceries/  settings/  notifications/
│  │  ├─ admin/                    # role-gated layout: reports/ users/ recipes/ restaurants/ imports/
│  │  └─ api/v1/                   # thin REST adapters over services
│  ├─ components/
│  │  ├─ ui/                       # shadcn primitives
│  │  ├─ macros/                   # MacroRing, MacroBar, ProvenanceBadge, RemainingMacros
│  │  ├─ social/                   # PostCard (+ per-type bodies), ReactionBar, VoteControl,
│  │  │                            #   CommentThread, UserChip, FollowButton
│  │  ├─ content/                  # RecipeCard, WorkoutCard, PrepCard, MenuItemRow, FilterSheet
│  │  ├─ tracking/                 # FoodSearch, BarcodeScanner, MealSection, ServingStepper
│  │  ├─ workouts/                 # SetRow, RestTimer, ExercisePicker, PlateMath
│  │  └─ charts/                   # WeightTrend, AdherenceChart, VolumeChart
│  ├─ lib/                         # zod schemas (shared api+form), pagination, rate-limit, dates, units
│  └─ cron/                        # trending.ts, streaks.ts, challenges.ts, reputation.ts, weekly-summary.ts
└─ tests/                          # unit (services), e2e (log-a-day, submit-recipe, follow-and-feed)
```

## 5. Keeping it simple instead of bloated

The spec above lists hundreds of features. The build survives only if the *systems* stay few:

1. **One social primitive.** Votes/saves/reactions/comments/reports/tags are each ONE polymorphic table + ONE service + ONE component. A new content type costs a schema table and a card component — never new interaction machinery. If a feature needs a new interaction type, that's a smell.
2. **Boards are queries, not features.** "Best budget meal prep," "trending this week," "best protein-per-calorie" — all are saved filter+sort presets over the same two ranked orderings. Zero new tables, zero new services per board.
3. **Everything loggable goes through one path.** Recipes, menu items, foods, saved meals all end as a `food_logs` snapshot row. One logging service, one add-food UI, one macro math module (`lib/units`).
4. **Milestones are detected, posts are offered.** No separate "milestone system" — PR/streak/weigh-in detection lives where the data is written, and produces a pre-filled post draft. The feed stays one system.
5. **Defer every second system.** No Redis, no queue, no search engine, no map tiles, no push, no DMs in MVP — each has a named trigger metric in [02-architecture §9](02-architecture.md) and a designed seam. Deferred ≠ unplanned.
6. **Cut personalization ML forever until proven needed.** Goal-fit is arithmetic over macros. It's explainable to users ("shown because it fits your remaining 42 g protein") which is itself a feature.
7. **Feature gate by phase, not by flag sprawl.** Ship whole verticals in order (tracker → recipes → social…). Avoid half-built everything.
8. **The 80/20 screens get the polish budget:** Track, Add Food, Recipe Detail, Feed. Every other screen can be plain. Users live in four screens; the rest are visited.
9. **Copy the privacy check, never reimplement it.** `privacy.ts` (`canView`, `serializeProfile`) is the single gate. PRs adding a second visibility check get rejected.
10. **When in doubt, make it a post.** Grocery hauls, restaurant finds, questions, tips — these are post types with a tag, not features. The list of post types can grow tenfold without the system growing at all.
