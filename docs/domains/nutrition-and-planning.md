# Nutrition and planning

## Scope and entry points

This domain spans the daily diary, food catalog, nutrients, barcode lookup, water, recipes, restaurant discovery/builds, saved orders, groceries, and meal-prep plans.

- Routes: `/track`, `/track/add`, `/recipes/**`, `/restaurants/**`, `/groceries`, `/meal-prep/**`.
- Actions: `logging.ts`, `barcode.ts`, `recipes.ts`, `restaurants.ts`, `groceries.ts`, `mealPreps.ts`, `imports.ts`.
- Libraries: `queries.ts`, `nutrients.ts`, `restaurants.ts`, `fallback-foods.ts`, `tabularFiles.ts`, `units.ts`, `utils.ts`.

## Diary and snapshot contract

Every `food_logs` row is an immutable nutrition snapshot of what the user logged. It can retain a `food_id`, `recipe_id`, or `menu_item_id` for provenance, but display name, serving count, macros, and micronutrients are copied at log time.

Do not join current source nutrition to render history and do not bulk-update historical logs when catalog content changes. Delete/undo uses an explicit `LogSnapshot` in `src/actions/logging.ts` to recreate the removed row.

Meal slots are `breakfast`, `lunch`, `dinner`, and `snack`. Dates are local calendar strings (`YYYY-MM-DD`) selected by the UI, not inferred from database timezone. Water is one aggregate row per user/date in milliliters.

The add-food surface supports:

- catalog search and bundled fallback search;
- favorite/saved recipes and frequent diary rows;
- quick-add macro snapshots;
- saved restaurant go-to orders and usual menu items;
- multi-add with a running tally before returning to the diary;
- camera/native or manual barcode lookup.

Frequents are computed from recent log history rather than maintained as a curated table.

## Nutrients and units

Calories and protein/carbohydrate/fat are required snapshots. Fiber, sodium, sugar, added sugar, saturated fat, cholesterol, potassium, calcium, iron, vitamins A/C/D are sparse. Unknown is `null`, never silently zero.

`src/lib/nutrients.ts` is the canonical nutrient list and daily-value metadata. `nutrientSnapshot()` scales source values by servings and `nutrientTotals()` aggregates only known values. Metric/imperial handling belongs in `src/lib/units.ts`; nutrition mass storage remains grams/milliliters.

## Foods and imports

`foods` is the shared catalog. Source values distinguish seed, user/admin, and external import provenance; `verified` is separate from source. Barcodes are indexed but schema uniqueness is not guaranteed, so lookup/action behavior must resolve duplicates deliberately.

Admin nutrition import accepts CSV or XLSX, capped at 2 MB, through `src/lib/tabularFiles.ts` and `src/actions/imports.ts`. Import batches record row counts, duplicates, errors, filename, target, and uploader. Imports must validate normalized headers and individual nutrition rows rather than trusting spreadsheet types.

## Recipes

Recipes store per-serving macros and can derive them from fully linked ingredient grams. Ingredient rows retain raw text and may reference either a shared food or the author's private `personal_ingredients`. If inputs cannot support a complete calculation, creator-entered macros remain possible with lower confidence/provenance.

Interaction primitives are shared:

- votes update up/down counters;
- saves update save count;
- reviews can represent “tried” without a rating or a 1–5 rating and update aggregates;
- logging copies a snapshot and increments log count;
- comments and feed sharing use the social domain.

Creation/edit behavior should recalculate all denormalized per-serving nutrition and preserve ingredient order. A source recipe edit must never rewrite diary history or already saved grocery text.

## Restaurants

Restaurant discovery combines coordinates, optional geocoding, distance, chain/menu data, remaining daily macros, and user filters. `src/lib/restaurants.ts` contains:

- Haversine distance and nearby location grouping;
- Nominatim geocoding;
- macro fit scoring/labels;
- “around me” filtering and sorting;
- combinatorial builds from ordered option groups;
- chain, popular order, personal order/usual, and saved-subject reads.

Menu items are fixed or buildable. For a buildable item, option macros are additive; group min/max choice constraints must be enforced by both UI and action. Avoid unbounded combination growth in `computeBuilds` when adding large option groups.

Go-to orders store a JSON recipe of item/option IDs plus a macro snapshot. Public orders can be logged by other users; private orders only by their owner. Repeat logging increments `log_count` and copies current saved snapshot values into the diary.

## Groceries and meal prep

Grocery actions create/use a user-owned list, allow manual item/toggle/delete/clear operations, and expand recipe or plan ingredients. Recipe-derived items keep a source recipe ID but are ordinary list rows afterward.

Meal-prep plans contain ordered recipe/serving pairs. Creation derives total servings and per-serving macros/cost/prep estimates from member recipes, then stores denormalized results. Plans support shared votes/saves and can be expanded into groceries.

## Safe change checklist

- Preserve diary and saved-order snapshot semantics.
- Treat null nutrients as unknown.
- Validate every source ID and ownership/public visibility in actions.
- Update denormalized counters/totals with their interaction rows.
- Bound restaurant builder combinations and import sizes.
- Revalidate diary, source detail/list, profile, groceries, and planning routes affected by a write.
- Add seed/reference data only through the safe paths described in [Operations](../operations.md).
