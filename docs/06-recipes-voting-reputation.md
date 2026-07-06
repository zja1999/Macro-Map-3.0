# MacroVerse — Community Recipe System, Restaurants, Voting & Reputation

## 1. Recipe lifecycle

```
draft → published → (edited: new recipe_version) → possibly forked / corrected / verified
                 ↘ removed (moderation) or deleted (author soft-delete)
```

Submission ([04-screens §6](04-screens.md)) pushes hard toward **linked ingredients**: every ingredient matched to a `foods` row makes macros machine-calculable. The form shows a live computed tally; if the creator's manual numbers diverge >15% from the ingredient calculation, the form flags it before publish and the recipe gets `creator_entered` provenance with low starting confidence.

Linking doesn't have to mean searching the shared database every time: a **personal ingredient library** (`personal_ingredients`, [03 schema](03-database-schema.md)) lets a user enter an ingredient's macros once — freeform quantity/unit, no verification — and pull it back out on every future recipe ("chicken breast, 6oz" becomes one tap). It's additive to the shared `foods` table, not a substitute: personal ingredients still calculate machine-derived per-serving macros (so the recipe still earns `ingredient_calculated` provenance), they're just private and unranked rather than community-verified. First-entry-saves-automatically is the whole mechanic — no separate "manage my ingredients" step required, though one exists for cleanup ([08 §1b](08-mvp-roadmap-phases.md)).

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

### 7a. Buildable items — "build a bowl" (core feature)

Chains like Chipotle, Subway, Cava, Qdoba, Sweetgreen, and poke/pizza shops don't have fixed items — they have **configurators**. These are first-class: a `menu_items` row with `kind='buildable'` plus option groups (`menu_item_option_groups` → `menu_item_options`), each option carrying its own per-portion macros (Chipotle publishes these; most build-line chains do).

Builder UX (see [04-screens §14a](04-screens.md)):
1. Open "Burrito Bowl" → stepper through groups: **Base → Protein → Toppings → Salsa → Extras**, respecting min/max choices (double protein = tap twice).
2. A **live macro tally bar** stays pinned at the bottom (same pattern as the recipe form's ingredient tally) and shows fit against *today's remaining* targets — the tally turns amber when a selection pushes past remaining calories.
3. Finish → **Log it** (a `food_logs` snapshot: summed macros, name like "Chipotle Bowl — chicken, white rice, black beans, fajitas, mild"), **Save as go-to order** (stores the option ids in `go_to_orders.items`, so it's re-loggable in one tap forever), and/or **Share** as a restaurant-find post.
4. Community layer on top: **popular builds** per buildable item = most-logged go-to orders, filterable by goal ("top cutting builds at Chipotle"). This is community data answering "what should I actually get here" — the core promise.

Data entry: option-level nutrition imports through the same admin CSV pipeline (chains publish per-ingredient nutrition tables); community-submitted options go through the same verification flow as fixed items.

### 7b. "Around me" — the concatenated nearby menu

The restaurant tab's default view answers *"I'm here, I have N calories and P protein left — what are my best options?"* in one list, without picking a chain first:

1. Browser/device geolocation (or manual address/city search via Nominatim geocoding — see [08 §1c](08-mvp-roadmap-phases.md) for the free/keyless Leaflet + OpenStreetMap + Nominatim + Overpass stack) → restaurants within an adjustable radius (indexed geo query) → distinct nearby chains. Map/list view toggle.
2. **Union all menu items across those chains** into one ranked list; buildable items rank by their *best-fit build* (precomputed per goal: max-protein build, min-calorie build, default build).
3. Rank = macro-fit score against the viewer's **remaining macros today** (from `food_logs`) — tolerance band on calories, protein density bonus, sodium penalty — falling back to goal-fit (cutting/bulking score) when the day is unlogged.
4. Each row: item, chain + distance, macro pills, fit badge ("fits your remaining 780 kcal / 52g protein"), one-tap Log.
5. Filters on top of the union: max calories, min protein, category, chain, "buildable only", sort by protein/kcal · lowest kcal · nearest.

This is a query composition over existing tables (restaurants-near → chains → menu_items + precomputed build variants), not a new subsystem — it ships with the Phase 4 restaurants vertical as its **default landing view**, with the per-chain browse one tap away.

### 7c. Combo-meal recommendation

Some chains structure orders as pairs (entree + side, sandwich + drink) rather than standalone items. Where that pairing is known (a lightweight `combo_group` tag shared across the relevant `menu_items` rows — no new table), the ranking step in §7b scores **pairs, not just singles**: for each entree, pick the side that best closes the gap to the viewer's remaining macros (highest protein-per-calorie side that still fits, or the closest total-calorie fit), and surface the pair as one recommendation row with its own fit badge and a single Log action that logs both items. Falls back to single-item ranking wherever combo structure isn't known — most items most of the time.

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
