# MacroVerse — Product Requirements Document

**Version:** 3.0 draft 1 · **Date:** 2026-07-03 · **Owner:** Zach

## 1. One-line pitch

A social fitness-nutrition platform where the community — not an AI prompt box — is the content engine: users track macros and workouts, and discover, share, vote on, save, and log recipes, meal preps, restaurant orders, and training programs created by other users.

## 2. Problem

- Macro trackers (MyFitnessPal, MacroFactor) are accurate but lonely. Logging is a chore with no social payoff, so adherence decays.
- Social fitness apps (Strava, Instagram fitness) are motivating but have no real nutrition data model — a progress photo can't be logged to your diary.
- Recipe sites have no macro trust: nutrition facts are wrong, unverifiable, and disconnected from your daily targets.
- Restaurant decisions are made blind. "What can I actually order at Chipotle on a cut?" is answered today by Reddit threads, not structured data.

**The gap:** nobody has fused a *trustworthy* nutrition/training data layer with a *social* graph, so the best community knowledge (recipes that actually hit macros, orders that actually work, programs people actually finish) never compounds.

**A note on positioning:** the product is both a social platform *and* a utility — get your targets, find what to eat nearby or build it yourself, log it, see progress — and the community/social layer accelerates that utility (better data, accountability, discovery) rather than competing with it for the front door. Concretely, that means: the *build sequence* leads with restaurants/recipes/tracker (Phase 4, see [08](08-mvp-roadmap-phases.md)) ahead of remaining social surface (workouts, groups, challenges — Phases 5–6), while the social systems already shipped (feed, follow, profiles, reactions) stay in place and keep growing alongside it.

## 3. Product principles

1. **Community content is the product.** No prompt-based meal/workout generation as a core feature. Every meal, prep plan, restaurant order, and workout in the app was made by a person and is attached to their reputation.
2. **Everything discoverable is loggable.** A recipe post, a restaurant order, a friend's meal — one tap logs it to your diary with real macros. Discovery → action, never a dead end.
3. **Trust is a first-class system.** Macros carry provenance (verified / ingredient-calculated / creator-entered / community-corrected / label-imported / estimated) and a confidence score. Quality rises through votes, logs, "tried it" marks, and accepted corrections.
4. **Social but goal-oriented.** The feed exists to help you hit your numbers, not to maximize scroll time. Reactions, challenges, and comparisons are framed around adherence and progress, not appearance.
5. **Useful at both ends of the skill curve.** Beginners get habit-based tracking, templates, and beginner-tagged content; advanced users get manual macro overrides, RPE logging, adherence analytics, and calorie banking.
6. **Safety by design.** Eating-disorder-sensitive defaults (no-scale mode, minimum-calorie floors, no body-shaming, misinformation flags) are product features, not afterthoughts.

## 4. Target users

| Persona | Goal | What they use most |
|---|---|---|
| **The Cutter** (22–35, tracks strictly) | Fat loss without losing muscle | Macro tracker, high-protein recipes, restaurant optimizer, "fits my remaining macros" |
| **The Beginner** (any age, first structured attempt) | General health, habit building | Habit tracking, beginner recipes/workouts, groups, challenges |
| **The Meal Prepper** (busy, budget-aware) | Consistency with minimal cooking | Meal prep plans, grocery lists, cost-per-serving rankings |
| **The Creator/Coach** | Audience + client accountability | Recipe/workout publishing, profile, reputation, (later) coach mode |
| **The Lifter** (intermediate–advanced) | Muscle gain / strength PRs | Workout logging, program sharing, progress analytics, bulk recipes |

## 5. Core user journeys

1. **Onboard → target:** goal, stats, activity, preferences, tracking style → calculated calorie/macro targets (manually overridable) → content interest selection → seeded feed and follow suggestions.
2. **Track a day:** log breakfast (saved meal), scan a barcode at lunch, log a community recipe for dinner, see remaining macros, get a "fits your remaining macros" recipe suggestion for a snack.
3. **Discover → cook → close the loop:** browse trending high-protein recipes → save → add ingredients to grocery list → cook Sunday → log 5 servings across the week → rate it, mark "tried," upvote → creator gains reputation.
4. **Eat out without guessing:** open restaurant optimizer near gym → sort menu items by protein-per-calorie → save a "go-to order" → post it as a restaurant find.
5. **Train from the community:** find a 3-day dumbbell program tagged beginner → save → log workouts against it → hit a PR → PR post auto-offered → friends react "strong."
6. **Stay accountable:** join a "30g fiber" challenge with two friends → weekly check-ins in the group → streak and leaderboard → completion badge.

## 6. Feature areas (summary)

Full behavior specs live in the linked design docs.

| # | Area | Summary | Doc |
|---|---|---|---|
| 1 | Onboarding | Goal, biometrics, tracking style (strict macro / calorie-only / protein-focused / habit / maintenance / performance / no-scale), TDEE calculation with manual override, content interests | [04-screens](04-screens.md) |
| 2 | Profiles | Fitness-focused social profile: bio, goal, training/diet style, submissions, badges, streaks, followers, opt-in macro goals / transformation timeline / PRs; granular privacy (per-field hide flags, public/friends/private) | [05-social](05-social-graph-and-profiles.md) |
| 3 | Social feed | Followed + friends + groups + trending; 15 post types (recipe, meal prep, workout, progress, restaurant find, grocery find, PR, milestone, question, tip…); fitness-specific reactions | [05-social](05-social-graph-and-profiles.md) |
| 4–6 | Community recipes | Full submission schema (macros, cost, time, equipment, tags, allergens), upvote/downvote/save/rate/tried/log/fork, macro provenance + confidence score, correction voting, ranking algorithm | [06-recipes](06-recipes-voting-reputation.md) |
| 7 | Meal prep | Multi-recipe plans with cost/serving, storage/reheat instructions, grocery list generation, fork, ranked boards (best budget, best 5-day, best under $50) | [06-recipes](06-recipes-voting-reputation.md) |
| 8 | Macro tracker | Daily diary: kcal/protein/carbs/fat/fiber/sugar/sodium/water/caffeine, barcode scan, copy day/meal, weekly averages, adherence score, streaks, calorie banking; **favorites ("my usual") distinct from auto-tracked frequents**; **personal ingredient library** for fast repeat recipe-building; logs community recipes and restaurant items natively | [04-screens](04-screens.md), [08](08-mvp-roadmap-phases.md) §1b |
| 9 | Restaurant optimizer | Chain + menu item database, macro-friendly rankings (protein/kcal ratio, cutting/bulking scores); free/keyless interactive map (Leaflet + OSM + Nominatim); **"Around me" cross-chain item list ranked against remaining macros**; **item builder ("build a bowl") with live macro tally** for build-line chains; **combo-meal recommendation**; community-submitted items, go-to orders, popular builds, trending orders nearby | [06-recipes](06-recipes-voting-reputation.md) §7–7c |
| 10–11 | Workouts | Strength/cardio/mobility logging (sets, reps, weight, RPE, rest), PR detection, template library, community workout posts with fork/complete/rate, discovery filters | [04-screens](04-screens.md) |
| 12 | Friends & following | Asymmetric follow (public content) + symmetric friendship (private sharing, accountability, DMs later) | [05-social](05-social-graph-and-profiles.md) |
| 13 | Groups | Goal/diet/location/gym-based groups; feed, shared content, challenges, leaderboards, mods, public/private | [05-social](05-social-graph-and-profiles.md) |
| 14 | Challenges | Time-boxed, metric-backed (auto-scored from logs where possible), public/friend leaderboards, badges, streaks | [05-social](05-social-graph-and-profiles.md) |
| 15 | Progress | Weight, measurements, body-fat, photos, PRs, adherence/consistency metrics, **habits tracker with per-habit streaks**; private-by-default with opt-in sharing tiers | [04-screens](04-screens.md), [08](08-mvp-roadmap-phases.md) §1b |
| 16 | Badges & reputation | Contribution-weighted reputation (upvotes, saves, logs of your content, accepted corrections); badge grants | [06-recipes](06-recipes-voting-reputation.md) §8 |
| 17 | Moderation & safety | Reports, review queue, mod roles, misinformation/unsafe-diet warnings, ED-sensitive design, content policy | [07-moderation](07-moderation.md) |
| 18 | Grocery | Lists built from recipes/preps, deduped, sectioned, costed; staples; community grocery finds | [04-screens](04-screens.md) |
| 19 | Discovery | Tabbed explore: trending recipes/workouts/preps, restaurant + grocery finds, transformations, groups, challenges, creators, "new users near my goal" | [04-screens](04-screens.md) |
| 20 | Notifications | Accountability-oriented (reminders, streaks, weekly summary) + social (comments, reactions, "someone tried your recipe"); per-category opt-out, daily digest batching | [02-architecture](02-architecture.md) |
| 21 | Admin | User/content management, report queue, macro verification, restaurant data import (CSV/PDF) with **validation, duplicate detection, and upload changelog**, chain request tracking, featuring, roles | [07-moderation](07-moderation.md), [08](08-mvp-roadmap-phases.md) §1d |
| 22 | User feedback | Always-available "send feedback" entry point, rate-limited, admin-reviewed queue — separate from content moderation reports | [08](08-mvp-roadmap-phases.md) §1d |
| 23 | Guest mode | Anonymous session, full functionality with no signup; "claim your account" converts it to a normal account with no data migration | [08](08-mvp-roadmap-phases.md) §1a |

## 7. Non-goals (v1)

- No AI meal/workout generation, AI chat, or AI coaching.
- No native mobile apps (mobile-first responsive web; API designed for future native clients).
- No DMs in MVP (friendship exists; messaging is roadmap phase 2).
- No wearable/health-platform integrations in MVP.
- No payments/monetization in MVP (architecture leaves room; see roadmap).
- No video hosting beyond short clips via the standard media pipeline.

## 8. Success metrics

**North star:** weekly logging users who also performed a community action (saved/voted/logged someone else's content) that week — "community-fed adherence."

Supporting:
- D7 / D30 retention of onboarded users
- % of food logs sourced from community recipes or restaurant DB (vs. raw manual entry) — target rising over time
- Recipes logged ≥10 times by non-creators (proxy for genuinely useful content)
- Median time-to-first-log after signup (< 10 minutes)
- Macro-correction acceptance latency (< 72h) and % of top-100 recipes with `verified` or `ingredient-calculated` provenance
- Report resolution time (< 24h)

## 9. Risks

| Risk | Mitigation |
|---|---|
| Cold start — empty feed, no recipes | Seed with a curated verified recipe/food/restaurant dataset (USDA + top-50 chains); onboarding follows topic feeds, not just people; "trending" falls back to seeded content |
| Inaccurate community macros poison trust | Provenance labels + confidence score from day one; ingredient-level calculation as default submission path; correction voting; unverified warning labels |
| ED-adjacent misuse | Calorie floors, no-scale mode, no public weight by default, banned content policy, sensitive-content reporting category, resource interstitials |
| Feature bloat kills velocity | Hard MVP line (see [08-mvp-roadmap](08-mvp-roadmap-phases.md)); "one social primitive, many content types" architecture |
| Moderation load scales with UGC | Reputation-gated submission rights, rate limits, report thresholds that auto-hide, small mod tooling early |

## 10. Requested-output index

1. PRD — this document
2. Technical architecture — [02-architecture.md](02-architecture.md)
3. Relational database schema — [03-database-schema.md](03-database-schema.md)
4. Screen-by-screen UI plan — [04-screens.md](04-screens.md)
5. Social graph design — [05-social-graph-and-profiles.md](05-social-graph-and-profiles.md) §1–2
6. User profile design — [05-social-graph-and-profiles.md](05-social-graph-and-profiles.md) §3
7. Community recipe system — [06-recipes-voting-reputation.md](06-recipes-voting-reputation.md) §1–6
8. Voting & reputation system — [06-recipes-voting-reputation.md](06-recipes-voting-reputation.md) §8
9. Moderation system — [07-moderation.md](07-moderation.md)
10. MVP feature list — [08-mvp-roadmap-phases.md](08-mvp-roadmap-phases.md) §1
11. Future roadmap — [08-mvp-roadmap-phases.md](08-mvp-roadmap-phases.md) §2
12. Recommended tech stack — [02-architecture.md](02-architecture.md) §1
13. Development phases — [08-mvp-roadmap-phases.md](08-mvp-roadmap-phases.md) §3
14. Files/modules to create — [08-mvp-roadmap-phases.md](08-mvp-roadmap-phases.md) §4
15. Keeping it simple — [08-mvp-roadmap-phases.md](08-mvp-roadmap-phases.md) §5
