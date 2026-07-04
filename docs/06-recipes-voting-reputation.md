# Macro Map — Community Recipe System, Restaurants, Voting & Reputation

## 1. Recipe lifecycle

```
draft → published → (edited: new recipe_version) → possibly forked / corrected / verified
                 ↘ removed (moderation) or deleted (author soft-delete)
```

Submission ([04-screens §6](04-screens.md)) pushes hard toward **linked ingredients**: every ingredient matched to a `foods` row makes macros machine-calculable. The form shows a live computed tally; if the creator's manual numbers diverge >15% from the ingredient calculation, the form flags it before publish and the recipe gets `creator_entered` provenance with low starting confidence.

## 2. Macro provenance & confidence

Every recipe (and menu item) displays a `ProvenanceBadge`:

| `macro_source` | Meaning | Base confidence |
|---|---|---|
| `verified` | Admin/mod checked against ingredients or lab source | 0.95 |
| `ingredient_calculated` | ≥90% of ingredient mass linked to canonical foods | 0.80 |
| `label_imported` | From official nutrition label/PDF/CSV (menu items mostly) | 0.85 |
| `community_corrected` | Creator/mods accepted a community correction | 0.70 |
| `creator_entered` | Manual numbers, unverifiable | 0.30 |
| `estimated` | Explicitly rough (e.g., "restaurant copycat, estimated") | 0.20 |

Confidence then moves with evidence: +0.02 per 10 unique users who logged it without filing a correction (cap +0.15), −0.10 per open macro-accuracy report past a threshold, reset on any macro edit. Recipes below 0.5 render a subtle "unverified macros" label; below 0.3 they're excluded from "fits my remaining macros" suggestions (still searchable).

## 3. Corrections

Any user can suggest: macro fix, serving-size fix, or ingredient substitution — a `recipe_corrections` row with structured `proposed` payload + rationale. Resolution path:
1. Creator gets a notification; can accept (applies edit → new version, provenance → `community_corrected`, correction author gets reputation) or reject with note.
2. If creator idle 7 days **and** the correction has net ≥5 community upvotes (corrections are votable subjects), it enters the mod queue for adjudication.
3. Accepted corrections never rewrite past `food_logs` (macro snapshots) — a banner on the recipe notes "macros updated on <date>."

## 4. Forking & versions

**Fork** = new recipe with `forked_from_id`, pre-filled, clearly bylined "forked from @user's X" with backlink (original creator gets a notification + small reputation credit when forks perform well). **Versions** = every edit snapshots to `recipe_versions`; detail page offers a field-level diff view (ingredients/macros/instructions) between versions or between fork and parent. Same mechanics apply to meal prep plans and workouts.

## 5. Ranking

Two distinct orderings, both precomputed by cron ([architecture §4](02-architecture.md)):

**Hot score** (feed/trending; time-decayed Reddit-style):

```
hot = log10(max(1, W)) + age_hours / -12.5     -- higher = hotter; recompute every 10 min
W   = 3·net_votes + 2·saves + 4·log_count + 3·tried_count + 1·comments
```

Logging weighs most — someone eating the food is the strongest quality signal this platform uniquely has.

**Quality score** (search/filter default sort; time-independent, Wilson-adjusted so 9/10 upvotes ≠ 900/1000):

```
quality = wilson_lower_bound(upvotes, downvotes)
        · (0.5 + 0.5·macro_confidence)
        · (1 + min(0.3, log_count/500))
        · (0.9 + 0.1·min(1, creator_reputation/1000))
```

**Personalization** is filtering, not ML: dietary/allergen hard filters from profile, goal-fit boost (cutting → protein-per-calorie band), "fits remaining macros" band, cost/prep-time preference weighting. Deterministic, explainable, cheap.

## 6. Meal prep plans

Same trust + voting + fork machinery over a composition of recipes ([schema](03-database-schema.md)). Plan-level macros/cost derive from member recipes (recomputed on member-recipe edit, with a "plan updated" note). Ranked boards are saved filter+sort presets, not separate systems: *best budget* = quality sort where cost_per_serving < threshold; *best 5-day* = days_covered = 5; *most saved this week* = save-count window.

## 7. Restaurant & menu item system

Data enters three ways: **admin import** (CSV/PDF from chain nutrition pages → `label_imported`, verified), **community submission** (user submits item with photo of nutrition info → mod review → verified or `creator_entered`), **requests** (user requests a chain, others upvote via `votes`; admin works the leaderboard of requested chains).

Derived scores shown on items (computed columns / on write):
- `protein_per_100kcal` (the headline metric)
- **cutting score** = protein density + kcal ceiling fit + sodium penalty
- **bulking score** = protein + calorie sufficiency
- sodium warning at >40% daily value per item

Community layer: ratings + tips, popular modifications, **go-to orders** (public multi-item combos, loggable in one tap), trending orders nearby (go-to order log counts, geo-bucketed). Everything loggable via the standard `food_logs` snapshot path.

## 8. Reputation system

Append-only `reputation_events`, aggregated to `users.reputation` by cron. Earning:

| Event | Points |
|---|---|
| Your recipe/workout/prep upvoted | +2 (−1 for downvote, floor 0 per item/day 40) |
| Your content saved | +3 |
| Your content **logged/completed** by others | +5 |
| Marked "tried" by others | +3 |
| Your correction accepted | +15 |
| Menu item you submitted verified | +10 |
| Challenge completed | +5 |
| Helpful comment (≥5 reactions) | +2 |
| Your report actioned as valid | +2 |
| Your content removed by mods | −50 |

Reputation **unlocks capability, never buys visibility directly** (it enters quality score only as the small ≤10% factor above):
- <10: posts excluded from Trending; submission rate limits tight
- ≥50: submit menu items without pre-review
- ≥200: corrections auto-surface to creators with priority
- ≥500: eligible for community-mod (report triage) role
- Badges ([schema `badges`](03-database-schema.md)) are granted from machine-checkable criteria (high-protein chef = 10 published recipes ≥30g protein with quality > x; recipe tester = 25 tried-marks given; consistency = 30-day log streak; restaurant scout = 10 verified item submissions; etc.). Badges are cosmetic + trust signals, no gameplay power.

Anti-gaming: vote rows are unique per user/subject; self-votes excluded; vote-ring detection deferred but the append-only event log makes retroactive recompute possible; new-account votes (<7 days) count for feed but at 0 reputation points; reciprocal-vote-pair damping when it becomes a problem, not before.
