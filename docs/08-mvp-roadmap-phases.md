# Macro Map — MVP, Roadmap, Development Phases, Module Layout & Simplicity Rules

## 1. MVP feature list

The MVP is one sentence: **track your macros, and everything you can discover you can log.**

| Included | Notes |
|---|---|
| Accounts + onboarding | All 7 tracking styles; calculated targets + manual override |
| Profiles + privacy matrix | Opt-in modules present but minimal styling |
| Follow + friend requests + block | No DMs |
| Home feed (Following/Friends/Trending) + posts + comments + reactions | All post types that don't depend on unbuilt systems |
| Recipe submission, detail, discovery, votes, saves, ratings, tried, **log-to-diary** | Ingredient-linked macro calculation; provenance badges; corrections = simple report-to-creator flow (voting on corrections is phase 2) |
| Macro tracker | kcal/P/C/F/fiber/sugar/sodium/water, barcode scan, saved meals, copy day/meal, weekly averages, adherence, streaks |
| Restaurant DB + optimizer | Admin-imported top chains, item rankings, log menu items, go-to orders. Map is a chain list + browser-geolocation "near me" in MVP — no map tiles |
| Workout logging + community workouts | Logger with PR detection; publish/save/complete/fork workouts; template shelf |
| Progress tracking | Weight/measurements/photos (private), charts, milestone share prompts |
| Groups + challenges | Public groups; auto-scored challenge metrics + custom check-in |
| Grocery lists from recipes/preps | Dedupe + sections + cost estimate |
| Meal prep plans | Compose from recipes; boards as saved filters |
| Admin: reports queue, user management, macro verification, CSV import | The minimum to run a UGC platform safely |
| Notifications (in-app inbox only) | No push/email in MVP |

**Explicitly out of MVP:** DMs, grocery-list sharing, correction voting, restaurant-request voting, pantry, coach mode, monetization, wearables, push notifications, PDF auto-extraction, dedicated search engine, native apps.

## 2. Future roadmap

**Phase 2 — deepen the loops (post-launch quarter):** DMs + friend accountability nudges · correction voting + community-mod role · restaurant request voting + community item submission at scale · grocery list sharing · progress photo timeline compare/export · push + email notifications (same `notifications` rows) · repost/share-with-comment.

**Phase 3 — ecosystem:** coach mode (client roster, shared logs with consent, check-in reviews) · creator pages + verified creators · advanced groups (private content collections) · advanced challenge types + sponsored challenges · pantry tracking ("what can I prep with what I have") · premium analytics.

**Phase 4 — platform:** mobile apps (React Native/Expo against `/api/v1`) · Apple Health / Google Fit / Strava / Garmin / smart-scale sync (steps, workouts, weight auto-fill) · local events + gym communities · dedicated search · monetization rollout.

**Monetization (when the community is real, not before):** freemium core (tracking + community forever free — the community *is* the moat; paywalling contribution kills it). Premium ($/mo): advanced analytics (trend modeling, adherence forecasting), calorie banking+, unlimited saved meals/lists, ad-free. Creator subscriptions (premium recipe packs/programs, revenue share). Coach tools (per-client pricing). Team/gym plans. Sponsored challenges + restaurant partnerships (clearly labeled). Grocery affiliate links on grocery lists. **Never sell:** ranking placement, health data.

## 3. Development phases (solo-dev-with-Claude sized)

| Phase | Scope | Exit criterion |
|---|---|---|
| **0. Foundation** (wk 1–2) | Next.js + Drizzle + Auth.js scaffold, schema migrated, seed scripts (USDA foods subset, exercises, tags, top-10 chains), design tokens + core components, media presign pipeline | Sign up → onboard → see targets |
| **1. Tracker** (wk 3–5) | Food search/barcode/log, tracker screen, saved meals, copy ops, streaks/adherence, progress entries + charts | A user can track a full week; *usable product for 1 person* |
| **2. Recipes** (wk 6–9) | Recipe CRUD + ingredients + provenance, discovery + filters, votes/saves/ratings/tried, log-recipe, grocery lists, hot/quality cron | Discover → save → groceries → log loop works |
| **3. Social** (wk 10–13) | Profiles, follow/friend/block, posts/comments/reactions, home feed, notifications inbox, milestone share prompts | Two accounts can fully interact |
| **4. Workouts + restaurants** (wk 14–17) | Workout logger + PRs, community workouts, templates; chains/menu items + rankings + go-to orders + CSV import | Both loggable content verticals live |
| **5. Community + safety** (wk 18–20) | Groups, challenges + auto-scoring, meal preps, reports + admin dashboard, rate limits, content warnings | Safe to open to strangers |
| **6. Beta hardening** (wk 21–22) | Playwright on critical flows, perf pass on feed/discovery queries, seed content push, copy/ED-safety review | Public beta |

Each phase ships behind nothing — the app is deployable and self-usable from Phase 1 onward. That ordering is deliberate: the tracker must be excellent *before* social, because the social layer's currency (logs, adherence, PRs) is minted by the tracker.

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
