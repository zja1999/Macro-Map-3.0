# Macro Map — Screen-by-Screen UI Plan

Mobile-first responsive web. Global shell: **bottom tab bar (mobile) / left rail (desktop)** with five tabs — **Feed · Discover · Log (+) · Track · Profile**. The center **Log (+)** is a raised action button opening a sheet: *Log food · Log workout · New post · Submit recipe · Weigh in*. Everything a user does daily is ≤2 taps from anywhere.

Shared component vocabulary (see `src/components/` in [08 §4](08-mvp-roadmap-phases.md)): `MacroRing`, `MacroBar`, `PostCard`, `RecipeCard`, `WorkoutCard`, `ProvenanceBadge`, `VoteControl`, `ReactionBar`, `FilterSheet`, `UserChip`, `EmptyState`.

---

### 1. Onboarding (multi-step wizard, ~6 steps, progress dots, skippable where safe)
1. **Account** — email/OAuth.
2. **Goal** — fat loss / muscle gain / maintenance / recomp / performance / general health / custom (card picker).
3. **About you** — height, weight (skippable in no-scale mode), age, sex, activity level, training days/week.
4. **Tracking style** — the 7 styles as cards with one-line explanations; picking `habit` or `no_scale` changes later UI (no calorie ring, habit checklist instead). Dietary prefs, allergies, budget, cooking skill, meal frequency on a follow-up card.
5. **Your targets** — calculated calories/macros (Mifflin-St Jeor × activity × goal delta) shown as editable fields; "I'll set my own" switches to manual entry. Floor enforcement with supportive copy.
6. **Interests** — multi-select chips (high-protein recipes, meal prep, fast food finds, cutting/bulking meals, budget, beginner workouts, strength, cardio, transformations, grocery finds…) → seeds Discover + suggested follows → land on Feed with a seeded "starter" feed, never empty.

### 2. Home feed (`/`)
Segmented control: **Following · Friends · Trending**. Infinite scroll of `PostCard`s — each renders a type-specific body (recipe cards show macros + Save/Log buttons inline; progress posts show delta chart; PR posts show lift + confetti-lite). Inline actions: react (long-press for fitness reaction picker), comment, save, share, log-it (for loggable types). Top strip: today's `MacroRing` mini-summary + streak flame (tap → Track). Pull-to-refresh. Empty states point to Discover.

### 3. Discover (`/discover`)
Tab row: **Recipes · Meal Prep · Workouts · Restaurants · Groups · Challenges · People**. Each tab = ranked horizontal shelves ("Trending this week", "Fits your remaining macros", "Best under $2/serving", "From people you follow", "New users near your goal") + a "See all" grid with `FilterSheet`. Search bar at top (unified: recipes, foods, users, chains).

### 4. Recipe feed (`/recipes`)
Pinterest-style 2-col masonry of `RecipeCard`s (photo, name, kcal/protein badges, rating, `ProvenanceBadge`). `FilterSheet`: macro ranges, prep time, cost, difficulty, tags, diet/allergen labels, "friends only". Sort: hot, top, newest, most logged, protein-per-calorie. Sticky "Fits today's macros" toggle applies remaining-target band.

### 5. Recipe detail (`/recipes/[id]`)
Hero photo carousel → name, author `UserChip`, `VoteControl`, save, share. **Macro panel:** per-serving macros with serving-count stepper, `ProvenanceBadge` (verified / calculated / creator / corrected / estimated) + confidence bar + "report inaccurate / suggest correction". **Action row:** `Log it` (slot picker) · `Add to plan` · `Groceries`. Then: ingredients (checkable, per-ingredient nutrition when linked), instructions, time/cost/equipment/storage grid, tags. Below: photo reviews, ratings, comments, "X people logged this", fork button + fork/version history ("compare versions" diff view).

### 6. Submit recipe (`/recipes/new`)
3-step form. **(1) Basics:** name, photos, description, servings. **(2) Ingredients:** typeahead against `foods` (linking = auto-calculated macros, strongly encouraged with a live macro tally in the footer); free-text fallback. **(3) Details:** instructions, times, difficulty, cost, equipment, storage, meal-prep score, tags/diet/allergen chips, nutrition-source note. If macros are manually overridden → warned "will display as creator-entered." Draft autosave.

### 7. Meal prep feed (`/meal-prep`) & 8. Meal prep detail (`/meal-prep/[id]`)
Feed mirrors recipe feed with prep-specific ranked boards (best budget, best 5-day, best under $50, most saved this week) and cost-per-serving front and center. Detail = plan photos, included recipes (linked cards), totals table (servings, kcal/protein per serving, cost/serving, days covered), storage + reheat instructions, equipment, grocery list preview → `Add all to groceries`, `Add to calendar` (fills `meal_plans`), log-a-serving, fork, Q&A comments.

### 9. Macro tracker (`/track`) — the daily home
Date scroller. `MacroRing` (kcal) + three `MacroBar`s (P/C/F) + expandable fiber/sugar/sodium/water/caffeine row. Meal sections (breakfast/lunch/dinner/snacks) with per-meal subtotals, tap-to-add. Footer: weekly average sparkline, adherence score, streak, calorie-banking balance (if enabled). Tracking-style aware: habit mode shows checklist ("protein at every meal ✓"), calorie-only hides macro bars.

### 10. Food log / 11. Add food (`/track/add`)
Add flow tabs: **Search · Barcode · My meals · Recent · Community**. Search hits `foods` + logged-recipe shortcuts; barcode → camera scan → food match or "create food". Community tab: saved recipes + "popular with people cutting" list. Serving stepper + slot picker → log. Copy-previous-day and copy-meal live on meal section menus. Any logged meal → "Share as post" affordance.

### 12. Restaurant map (`/restaurants`)
**Default view = "Around me": one concatenated, macro-ranked list of every item across nearby chains** — ranked by fit against today's *remaining* macros (fit badge per row: "fits your remaining 780 kcal / 52g protein"), one-tap Log on every row, filters (max kcal, min protein, chain, category, buildable-only). Map (nearby pins) + list toggle; chain search. Each chain row: "best items for you" preview (respects goal: cutting → protein/kcal; bulking → protein+calories). Trending orders nearby strip. "Request a chain" entry point (+ vote on open requests). Design: [06 §7b](06-recipes-voting-reputation.md).

### 13. Restaurant detail (`/restaurants/[chain]`)
Chain header, menu-item list with sort (protein ratio, highest protein, lowest kcal, lowest sodium, "under X kcal / over X g protein" steppers) and goal-fit score chips (cutting/bulking/post-workout scores). Community: submit missing item, go-to orders from the community, my saved orders.

### 14. Menu item detail (`/menu-items/[id]`)
Nutrition facts table + provenance, macro/protein/cutting/bulking scores, sodium warning if > threshold. `Log it`. Ratings + tips ("ask for double chicken, skip the rice"), popular modifications, photos, similar items, best nearby alternatives. Buildable items show a **Build it** CTA → §14a instead of a fixed nutrition table.

### 14a. Item builder (`/menu-items/[id]/build`) — "build a bowl"
Stepper through option groups (Base → Protein → Toppings → Salsa → Extras) with per-option macro chips; tap to add, tap again for double portions (respects group min/max). **Pinned live tally bar**: running kcal/P/C/F vs. today's remaining targets, amber when over. "Popular builds" shelf up top (most-logged community go-to orders for this item, filterable by goal) — start from one and tweak. Finish screen: **Log it · Save as go-to order · Share as post**. Design: [06 §7a](06-recipes-voting-reputation.md).

### 15. Workout tracker (`/workouts/log`)
Active-session UI: exercise list with set rows (weight × reps, RPE, rest timer with notification chime), plate-math helper, previous-session ghost values, add exercise via `exercises` typeahead. Finish → summary (volume, duration, est. calories, PRs detected with celebration + "share PR" one-tap post). History calendar below.

### 16. Workout feed (`/workouts`) & 17. Workout detail (`/workouts/[id]`)
Feed: `WorkoutCard`s (title, goal, duration, equipment, difficulty, completed count) with filters (muscle group, equipment, duration, difficulty, goal, friends', trending, beginner). Templates shelf (PPL, upper/lower, full body, dumbbell-only, hotel gym…). Detail: exercise table with sets/reps/rest, target-muscle diagram, media clips, creator notes, ratings, comments, reactions; actions: **Save · Start workout (→ logger prefilled) · Fork · Mark completed**; "X friends completed this."

### 18. Create workout (`/workouts/new`)
Builder: add exercises (search/filter library), per-exercise set schemes (sets × reps @ weight/RPE, rest), drag to reorder, supersets group, metadata (title, goal, difficulty, duration, equipment auto-derived, target muscles auto-derived), notes + media. Save private or publish.

### 19. Profile (`/u/[username]`)
Header: avatar, display name, username, bio, goal + training/diet style chips, location (if shown), badges strip, follower/following/friends counts, streaks. CTA: Follow / Friend / Message (later). Tab row: **Posts · Recipes · Workouts · Preps · Saved (own only) · Progress (permission-gated)**. Opt-in modules render only when enabled: public macro goals card, transformation timeline (before/after slider), PR board. Own profile: edit + privacy settings shortcut.

### 20. Friends (`/friends`)
Requests inbox, friends list with streak-comparison chips, close-friends toggle, suggested friends (mutuals, same goal, same groups). Accountability panel: "nudge" (cheer/reminder) buttons.

### 21. Messages (`/messages`) — *phase 2 placeholder route; hidden in MVP nav.*

### 22. Groups (`/groups`, `/groups/[slug]`)
Directory with category filters + my groups. Group page: cover, description, join/leave, member count; tabs **Feed · Recipes · Workouts · Challenges · Leaderboard · About**; pinned resources; weekly check-in thread (auto-created); mod tools for group mods.

### 23. Challenges (`/challenges`, `/challenges/[id]`)
Directory: active/upcoming/completed, joinable cards showing metric + duration + participant count. Detail: rules, my progress bar (auto-scored from logs where metric allows), public + friends leaderboards, updates feed, invite friends, badge preview; completion → certificate/badge + share prompt.

### 24. Progress dashboard (`/progress`)
Charts (weight trend with smoothing, measurements, body-fat, volume, PRs timeline, protein consistency %, calorie adherence, steps, sleep). Add-entry sheet (respects no-scale mode). Photo timeline (private, signed URLs) with side-by-side compare → optional "create transformation post" flow with explicit visibility choice. Export CSV.

### 25. Grocery list (`/groceries`)
Sectioned checklist (produce/meat/dairy/…), quantities merged across sources, per-item source recipe chip, est. total cost + cost-per-gram-protein readout, staples quick-add, mark purchased (swipe), share list (phase 2), "post grocery haul" affordance.

### 26. Settings (`/settings`)
Account, targets & tracking style (recalculate wizard), privacy matrix (visibility + all hide flags in one table UI), notification prefs per category, blocked users, data export, delete account. Safety section: no-scale mode toggle, sensitive-content preferences.

### 27. Admin dashboard (`/admin`) — role-gated
Sidebar: **Reports queue** (triage list, subject preview, action buttons wired to `moderation_actions`) · **Users** (search, warn/suspend/ban, role assignment) · **Recipes** (verify macros, warning labels, corrections review) · **Restaurants** (chains CRUD, menu-item CSV import with column mapper + validation preview, PDF request queue, chain-request vote board) · **Foods** (dataset import status, user-submitted food review) · **Tags / Groups / Challenges** management · **Feature content** picker · **Audit log**.
