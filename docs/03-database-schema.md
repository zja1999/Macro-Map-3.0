# Macro Map — Relational Database Schema (PostgreSQL)

Conventions: `id uuid PK default gen_random_uuid()`; `created_at timestamptz default now()` on every table (omitted below for brevity); `updated_at` on mutable tables; soft-delete via `deleted_at` only on UGC tables; enums as Postgres enums. Denormalized counters are maintained transactionally with their interaction rows.

Design keystones:
1. **One social primitive.** `posts`, `comments`, `reactions`, `votes`, `saves`, `reports`, `taggings` are polymorphic over content via `(subject_type, subject_id)`. Recipes/workouts/meal preps are structured entities; a *post* is how any of them (or a plain update) enters the feed.
2. **Provenance on every nutrition number.** Recipes and menu items carry `macro_source` + `confidence`; edits are versioned.
3. **Log rows reference canonical sources** (`food`, `recipe`, `menu_item`, or free-form) so community content usage is measurable — that usage feeds ranking and reputation.

```sql
-- ═══════════════ ENUMS ═══════════════
CREATE TYPE goal_type        AS ENUM ('fat_loss','muscle_gain','maintenance','recomp','performance','general_health','custom');
CREATE TYPE tracking_style   AS ENUM ('strict_macro','calorie_only','protein_focused','habit','maintenance','performance','no_scale');
CREATE TYPE visibility       AS ENUM ('public','friends','private');
CREATE TYPE subject_type     AS ENUM ('post','recipe','meal_prep_plan','workout','menu_item','comment','user','group','challenge','grocery_find');
CREATE TYPE post_type        AS ENUM ('recipe','meal_prep','workout','progress','restaurant_find','grocery_find','transformation','question','tip','challenge_update','personal_record','weigh_in_milestone','step_milestone','streak','meal_log_highlight','general');
CREATE TYPE reaction_kind    AS ENUM ('like','strong','clean_meal','high_protein','macro_win','pr','shredded','bulk_fuel','cutting_approved','meal_prep_win','brutal','clean_form','pump','endurance','beginner_friendly');
CREATE TYPE macro_source     AS ENUM ('verified','ingredient_calculated','creator_entered','community_corrected','label_imported','estimated');
CREATE TYPE friendship_status AS ENUM ('pending','accepted','declined','blocked');
CREATE TYPE report_reason    AS ENUM ('inaccurate_macros','unsafe_advice','harassment','body_shaming','ed_content','spam','stolen_content','fake_transformation','medical_claim','other');
CREATE TYPE mod_action_kind  AS ENUM ('remove_content','warn_user','suspend_user','ban_user','restore_content','verify_macros','add_warning_label','dismiss_report');
CREATE TYPE app_role         AS ENUM ('user','moderator','admin');
CREATE TYPE workout_kind     AS ENUM ('strength','cardio','mobility','mixed');
CREATE TYPE notif_kind       AS ENUM ('friend_request','comment','reaction','vote_milestone','tried_your_recipe','saved_your_content','correction_accepted','challenge_reminder','group_post','meal_reminder','protein_reminder','weigh_in_reminder','workout_reminder','weekly_summary','moderation','restaurant_request_approved');

-- ═══════════════ IDENTITY & PROFILE ═══════════════
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text,                       -- null when OAuth-only
  role app_role NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',    -- active|suspended|banned|deleted
  reputation int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username citext UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text, avatar_photo_id uuid,           -- FK to photos, added after photos
  goal goal_type, training_style text, dietary_style text,
  location text,
  height_cm numeric(5,1), sex text, birth_date date,
  activity_level text, training_days_per_week smallint,
  visibility visibility NOT NULL DEFAULT 'public',
  -- granular privacy flags (applied at serialization; see architecture §7)
  hide_weight bool DEFAULT true, hide_calories bool DEFAULT true,
  hide_progress_photos bool DEFAULT true, hide_location bool DEFAULT true,
  hide_measurements bool DEFAULT true,
  share_macro_goals bool DEFAULT false, share_prs bool DEFAULT false,
  share_transformation bool DEFAULT false,
  content_interests text[] DEFAULT '{}',    -- onboarding topic picks
  linked_socials jsonb DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nutrition_targets (             -- history-preserving; latest row is active
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracking_style tracking_style NOT NULL,
  calories int CHECK (calories >= 1200),
  protein_g int, carbs_g int, fat_g int, fiber_g int,
  is_manual bool NOT NULL DEFAULT false,     -- advanced-user override vs calculated
  effective_from date NOT NULL DEFAULT current_date
);
CREATE INDEX ON nutrition_targets(user_id, effective_from DESC);

-- ═══════════════ SOCIAL GRAPH ═══════════════
CREATE TABLE follows (
  follower_id uuid REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX ON follows(followee_id);        -- follower counts / lists

CREATE TABLE friendships (                    -- symmetric: store once with user_lo < user_hi
  user_lo uuid REFERENCES users(id) ON DELETE CASCADE,
  user_hi uuid REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  is_close_friend_lo bool DEFAULT false, is_close_friend_hi bool DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_lo, user_hi),
  CHECK (user_lo < user_hi)
);

CREATE TABLE blocks (
  blocker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ═══════════════ MEDIA ═══════════════
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,                     -- avatar|recipe|post|progress|review|workout
  storage_key text NOT NULL, variants jsonb, -- {thumb,feed,full}
  is_private bool NOT NULL DEFAULT false,    -- progress photos: always true
  status text NOT NULL DEFAULT 'pending',    -- pending|ready|removed
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD FOREIGN KEY (avatar_photo_id) REFERENCES photos(id);

CREATE TABLE media_attachments (             -- links photos/clips to any subject
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  position smallint NOT NULL DEFAULT 0
);
CREATE INDEX ON media_attachments(subject_type, subject_id);

-- ═══════════════ POSTS / COMMENTS / REACTIONS (one social primitive) ═══════════════
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type post_type NOT NULL DEFAULT 'general',
  body text,
  ref_type subject_type, ref_id uuid,        -- structured entity this post showcases (recipe, workout…)
  group_id uuid,                             -- FK added after groups
  challenge_id uuid,                         -- FK added after challenges
  visibility visibility NOT NULL DEFAULT 'public',
  comment_count int NOT NULL DEFAULT 0, reaction_count int NOT NULL DEFAULT 0,
  save_count int NOT NULL DEFAULT 0,
  is_removed bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX ON posts(author_id, created_at DESC);
CREATE INDEX ON posts(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX ON posts(type, created_at DESC);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  parent_id uuid REFERENCES comments(id),    -- one-level threading
  body text NOT NULL,
  reaction_count int NOT NULL DEFAULT 0,
  is_removed bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX ON comments(subject_type, subject_id, created_at);

CREATE TABLE reactions (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  kind reaction_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_type, subject_id)   -- one reaction per user per subject
);
CREATE INDEX ON reactions(subject_type, subject_id);

CREATE TABLE votes (                          -- recipes, meal preps, menu items, corrections
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_type, subject_id)
);
CREATE INDEX ON votes(subject_type, subject_id);

CREATE TABLE saves (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_type, subject_id)
);
CREATE INDEX ON saves(user_id, created_at DESC);   -- "my saved" pages

CREATE TABLE tags (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,                 -- high-protein, meal-prep, air-fryer, cutting…
  kind text NOT NULL DEFAULT 'general'       -- general|diet|allergen|equipment|meal|goal
);
CREATE TABLE taggings (
  tag_id int REFERENCES tags(id) ON DELETE CASCADE,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  PRIMARY KEY (tag_id, subject_type, subject_id)
);
CREATE INDEX ON taggings(subject_type, subject_id);

-- ═══════════════ FOODS & LOGGING ═══════════════
CREATE TABLE foods (                          -- canonical foods: USDA + OFF + user/admin submissions
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, brand text,
  barcode text, source text NOT NULL,        -- usda|off|user|admin
  serving_desc text NOT NULL, serving_grams numeric(7,1),
  calories numeric(7,1) NOT NULL, protein_g numeric(6,1) NOT NULL,
  carbs_g numeric(6,1) NOT NULL, fat_g numeric(6,1) NOT NULL,
  fiber_g numeric(6,1), sugar_g numeric(6,1), sodium_mg numeric(8,1),
  micros jsonb,                               -- optional micronutrients
  verified bool NOT NULL DEFAULT false,
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', name || ' ' || coalesce(brand,''))) STORED
);
CREATE INDEX ON foods USING gin(search);
CREATE INDEX ON foods(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date date NOT NULL, meal_slot text NOT NULL,   -- breakfast|lunch|dinner|snack|custom
  -- exactly one source (or none = quick-add)
  food_id uuid REFERENCES foods(id),
  recipe_id uuid,                             -- FK added after recipes
  menu_item_id uuid,                          -- FK added after menu_items
  servings numeric(6,2) NOT NULL DEFAULT 1,
  -- macro snapshot AT LOG TIME (source may be edited later; history must not shift)
  calories numeric(7,1) NOT NULL, protein_g numeric(6,1) NOT NULL,
  carbs_g numeric(6,1) NOT NULL, fat_g numeric(6,1) NOT NULL,
  fiber_g numeric(6,1), sugar_g numeric(6,1), sodium_mg numeric(8,1),
  note text, logged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON food_logs(user_id, log_date);
CREATE INDEX ON food_logs(recipe_id) WHERE recipe_id IS NOT NULL;  -- "times logged" ranking signal

CREATE TABLE water_logs (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  log_date date NOT NULL, ml int NOT NULL DEFAULT 0, caffeine_mg int DEFAULT 0,
  PRIMARY KEY (user_id, log_date)
);

CREATE TABLE saved_meals (                    -- user's reusable meal bundles
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, items jsonb NOT NULL    -- [{food_id|recipe_id, servings}]
);

-- ═══════════════ RECIPES ═══════════════
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  forked_from_id uuid REFERENCES recipes(id),
  name text NOT NULL, description text, instructions text NOT NULL,
  servings numeric(5,1) NOT NULL, serving_desc text,
  -- per-serving macros (denormalized for filters; recomputed from ingredients when possible)
  calories numeric(7,1) NOT NULL, protein_g numeric(6,1) NOT NULL,
  carbs_g numeric(6,1) NOT NULL, fat_g numeric(6,1) NOT NULL,
  fiber_g numeric(6,1), sugar_g numeric(6,1), sodium_mg numeric(8,1),
  macro_source macro_source NOT NULL DEFAULT 'creator_entered',
  macro_confidence numeric(3,2) NOT NULL DEFAULT 0.30,   -- 0–1, see 06 §6
  nutrition_notes text,
  prep_min int, cook_min int, difficulty smallint CHECK (difficulty BETWEEN 1 AND 5),
  cost_estimate_cents int, equipment text[], storage_notes text,
  meal_prep_score smallint,                   -- creator-declared 1–5 "how well it keeps"
  status text NOT NULL DEFAULT 'published',   -- draft|published|removed
  -- denormalized ranking inputs
  upvotes int NOT NULL DEFAULT 0, downvotes int NOT NULL DEFAULT 0,
  save_count int NOT NULL DEFAULT 0, log_count int NOT NULL DEFAULT 0,
  tried_count int NOT NULL DEFAULT 0,
  rating_avg numeric(3,2), rating_count int NOT NULL DEFAULT 0,
  hot_score real NOT NULL DEFAULT 0,          -- refreshed by cron, see 06 §8
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(description,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX ON recipes USING gin(search);
CREATE INDEX ON recipes(hot_score DESC) WHERE status = 'published';
CREATE INDEX ON recipes(protein_g DESC, calories) WHERE status = 'published';
CREATE INDEX ON recipes(author_id, created_at DESC);

CREATE TABLE recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id uuid REFERENCES foods(id),          -- linked → enables ingredient-calculated macros
  raw_text text NOT NULL,                     -- "200g chicken breast"
  quantity numeric(8,2), unit text, grams numeric(8,1),
  grocery_section text, position smallint NOT NULL
);

CREATE TABLE recipe_reviews (                 -- rating + optional photo review + "tried it"
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  tried bool NOT NULL DEFAULT true, body text,
  UNIQUE (recipe_id, user_id)
);

CREATE TABLE recipe_corrections (             -- community macro/substitution suggestions
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,                         -- macro_fix|substitution|serving_size
  proposed jsonb NOT NULL,                    -- {calories: 520, protein_g: 42, note: "..."}
  rationale text,
  status text NOT NULL DEFAULT 'open',        -- open|accepted|rejected (creator or mods; vote-assisted)
  resolved_by uuid REFERENCES users(id), resolved_at timestamptz
);

CREATE TABLE recipe_versions (                -- edit history / fork comparison
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version int NOT NULL, snapshot jsonb NOT NULL,
  edited_by uuid NOT NULL REFERENCES users(id),
  UNIQUE (recipe_id, version)
);
ALTER TABLE food_logs ADD FOREIGN KEY (recipe_id) REFERENCES recipes(id);

-- ═══════════════ MEAL PREP & MEAL PLANS ═══════════════
CREATE TABLE meal_prep_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  forked_from_id uuid REFERENCES meal_prep_plans(id),
  title text NOT NULL, description text,
  days_covered smallint, total_servings smallint,
  goal goal_type, difficulty smallint,
  grocery_cost_cents int, prep_min int,
  storage_notes text, reheat_notes text, equipment text[],
  -- denormalized per-serving macros + ranking counters (same pattern as recipes)
  calories numeric(7,1), protein_g numeric(6,1),
  cost_per_serving_cents int GENERATED ALWAYS AS
    (CASE WHEN total_servings > 0 THEN grocery_cost_cents / total_servings END) STORED,
  upvotes int DEFAULT 0, downvotes int DEFAULT 0, save_count int DEFAULT 0,
  hot_score real NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE meal_prep_items (
  plan_id uuid REFERENCES meal_prep_plans(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES recipes(id),
  servings numeric(5,1) NOT NULL, position smallint NOT NULL,
  PRIMARY KEY (plan_id, position)
);

CREATE TABLE meal_plans (                     -- personal calendar: which meals on which days
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date date NOT NULL, meal_slot text NOT NULL,
  recipe_id uuid REFERENCES recipes(id), food_id uuid REFERENCES foods(id),
  servings numeric(5,1) NOT NULL DEFAULT 1
);
CREATE INDEX ON meal_plans(user_id, plan_date);

-- ═══════════════ GROCERY ═══════════════
CREATE TABLE grocery_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Groceries', shared_with uuid[] DEFAULT '{}'
);
CREATE TABLE grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name text NOT NULL, quantity text, section text,
  est_cost_cents int, purchased bool NOT NULL DEFAULT false,
  source_recipe_id uuid REFERENCES recipes(id),
  is_staple bool NOT NULL DEFAULT false
);

-- ═══════════════ RESTAURANTS ═══════════════
CREATE TABLE chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL, logo_photo_id uuid REFERENCES photos(id),
  nutrition_source_url text, verified bool NOT NULL DEFAULT false
);
CREATE TABLE restaurants (                    -- physical locations (for map/nearby)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid REFERENCES chains(id),
  name text NOT NULL, lat double precision, lng double precision,
  address text, source text NOT NULL DEFAULT 'user'
);
CREATE INDEX ON restaurants USING gist (point(lng, lat));   -- or PostGIS later

CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  name text NOT NULL, category text,
  kind text NOT NULL DEFAULT 'fixed',        -- fixed | buildable (Chipotle bowl, Subway sandwich…)
  -- for kind='buildable': macros below are the default build; real macros come from options
  calories numeric(7,1) NOT NULL, protein_g numeric(6,1) NOT NULL,
  carbs_g numeric(6,1) NOT NULL, fat_g numeric(6,1) NOT NULL,
  fiber_g numeric(6,1), sugar_g numeric(6,1), sodium_mg numeric(8,1),
  macro_source macro_source NOT NULL DEFAULT 'label_imported',
  submitted_by uuid REFERENCES users(id), verified bool NOT NULL DEFAULT false,
  -- derived scores (computed on write; used by rankings)
  protein_per_100kcal numeric(5,2) GENERATED ALWAYS AS
    (CASE WHEN calories > 0 THEN protein_g * 100 / calories END) STORED,
  rating_avg numeric(3,2), rating_count int NOT NULL DEFAULT 0,
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', name)) STORED
);
CREATE INDEX ON menu_items(chain_id, protein_per_100kcal DESC);
CREATE INDEX ON menu_items USING gin(search);

-- ── buildable items ("build a bowl") ──
-- A buildable menu_item has option groups (Base, Protein, Toppings, Salsa…); each option
-- carries its own per-portion macros. The builder UI sums selections live; the result is
-- logged as a food_logs snapshot and can be saved/shared as a go_to_order (stores option ids).
CREATE TABLE menu_item_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,                        -- "Base", "Protein", "Toppings"
  min_choices smallint NOT NULL DEFAULT 0,
  max_choices smallint,                      -- null = unlimited
  position smallint NOT NULL DEFAULT 0
);
CREATE TABLE menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES menu_item_option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,                        -- "White rice", "Double chicken"
  portion_desc text,                         -- "1 scoop (4 oz)"
  calories numeric(7,1) NOT NULL, protein_g numeric(6,1) NOT NULL,
  carbs_g numeric(6,1) NOT NULL, fat_g numeric(6,1) NOT NULL,
  fiber_g numeric(6,1), sodium_mg numeric(8,1),
  is_default bool NOT NULL DEFAULT false,
  position smallint NOT NULL DEFAULT 0
);
CREATE INDEX ON menu_item_option_groups(menu_item_id);
CREATE INDEX ON menu_item_options(group_id);

CREATE TABLE menu_item_ratings (
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  rating smallint CHECK (rating BETWEEN 1 AND 5), tip text,
  PRIMARY KEY (menu_item_id, user_id)
);

CREATE TABLE go_to_orders (                   -- saved multi-item restaurant orders
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES chains(id),
  name text NOT NULL, items jsonb NOT NULL,   -- [{menu_item_id, qty, mods}]
  is_public bool NOT NULL DEFAULT true
);

CREATE TABLE restaurant_requests (            -- "add this chain" + votes via votes table
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES users(id),
  chain_name text NOT NULL, notes text, nutrition_pdf_key text,
  status text NOT NULL DEFAULT 'open'         -- open|approved|imported|rejected
);
ALTER TABLE food_logs ADD FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);

-- ═══════════════ WORKOUTS ═══════════════
CREATE TABLE exercises (                      -- canonical exercise library (seeded + admin)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL, muscle_groups text[], equipment text[],
  kind workout_kind NOT NULL DEFAULT 'strength', is_bodyweight bool DEFAULT false
);

CREATE TABLE workouts (                       -- shareable workout definitions (community + templates)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,   -- null = official template
  forked_from_id uuid REFERENCES workouts(id),
  title text NOT NULL, description text,
  kind workout_kind NOT NULL, goal goal_type,
  difficulty smallint, est_duration_min int,
  equipment text[], target_muscles text[],
  is_template bool NOT NULL DEFAULT false,    -- official PPL/UL/full-body starters
  structure jsonb NOT NULL,                   -- [{exercise_id, sets:[{reps, weight?, rest_s, rpe?}], notes}]
  save_count int DEFAULT 0, completed_count int DEFAULT 0,
  rating_avg numeric(3,2), rating_count int DEFAULT 0,
  hot_score real NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || coalesce(description,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX ON workouts(hot_score DESC) WHERE status = 'published';

CREATE TABLE workout_logs (                   -- performed sessions
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES workouts(id),    -- null = freeform session
  performed_at timestamptz NOT NULL DEFAULT now(),
  duration_min int, calories_burned_est int, notes text,
  entries jsonb NOT NULL                      -- [{exercise_id, sets:[{reps, weight_kg, rpe, rest_s}]}]
);
CREATE INDEX ON workout_logs(user_id, performed_at DESC);

CREATE TABLE personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  metric text NOT NULL,                       -- 1rm|volume|reps|distance|time
  value numeric(9,2) NOT NULL, achieved_at timestamptz NOT NULL,
  workout_log_id uuid REFERENCES workout_logs(id),
  UNIQUE (user_id, exercise_id, metric)
);

-- ═══════════════ PROGRESS ═══════════════
CREATE TABLE progress_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  weight_kg numeric(5,2), body_fat_pct numeric(4,1),
  waist_cm numeric(5,1), hips_cm numeric(5,1), chest_cm numeric(5,1),
  arms_cm numeric(5,1), thighs_cm numeric(5,1), neck_cm numeric(5,1),
  steps int, sleep_hours numeric(3,1), note text,
  visibility visibility NOT NULL DEFAULT 'private',
  UNIQUE (user_id, entry_date)
);
-- progress photos: photos(purpose='progress', is_private=true) + media_attachments → progress_entries

-- ═══════════════ GROUPS & CHALLENGES ═══════════════
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug citext UNIQUE NOT NULL, description text,
  kind text NOT NULL DEFAULT 'goal',          -- goal|diet|location|gym|interest
  is_private bool NOT NULL DEFAULT false,
  cover_photo_id uuid REFERENCES photos(id),
  member_count int NOT NULL DEFAULT 0,
  pinned_post_ids uuid[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id)
);
CREATE TABLE group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',        -- member|moderator|owner
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE posts ADD FOREIGN KEY (group_id) REFERENCES groups(id);

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id),        -- null = global challenge
  created_by uuid NOT NULL REFERENCES users(id),
  title text NOT NULL, description text,
  metric text NOT NULL,                       -- protein_days|steps|workouts|fiber_days|logged_days|custom_checkin
  target numeric(9,1) NOT NULL, unit text,
  starts_on date NOT NULL, ends_on date NOT NULL,
  is_public bool NOT NULL DEFAULT true, badge_id uuid
);
CREATE TABLE challenge_participants (
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  progress numeric(9,1) NOT NULL DEFAULT 0,   -- auto-scored from logs by nightly cron where metric allows
  completed_at timestamptz,
  PRIMARY KEY (challenge_id, user_id)
);
ALTER TABLE posts ADD FOREIGN KEY (challenge_id) REFERENCES challenges(id);

-- ═══════════════ REPUTATION, BADGES, STREAKS ═══════════════
CREATE TABLE reputation_events (              -- append-only; aggregated into users.reputation
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,                         -- recipe_upvoted|content_saved|content_logged|correction_accepted|…
  points int NOT NULL,
  subject_type subject_type, subject_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON reputation_events(user_id, created_at);

CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL, name text NOT NULL, description text,
  icon text, criteria jsonb                   -- machine-checkable grant rule where possible
);
CREATE TABLE user_badges (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE streaks (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,                         -- logging|protein|workout|weigh_in
  current int NOT NULL DEFAULT 0, best int NOT NULL DEFAULT 0,
  last_qualified_date date,
  PRIMARY KEY (user_id, kind)
);

-- ═══════════════ MODERATION & NOTIFICATIONS ═══════════════
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  reason report_reason NOT NULL, detail text,
  status text NOT NULL DEFAULT 'open',        -- open|reviewing|actioned|dismissed
  reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz
);
CREATE INDEX ON reports(status, created_at) WHERE status = 'open';

CREATE TABLE moderation_actions (             -- audit log of everything mods/admins do
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  kind mod_action_kind NOT NULL,
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  report_id uuid REFERENCES reports(id), reason text NOT NULL
);

CREATE TABLE content_warnings (               -- misinformation / unsafe-diet / unverified-macros labels
  subject_type subject_type NOT NULL, subject_id uuid NOT NULL,
  kind text NOT NULL, note text,
  added_by uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (subject_type, subject_id, kind)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind notif_kind NOT NULL,
  actor_id uuid REFERENCES users(id),
  subject_type subject_type, subject_id uuid,
  payload jsonb, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE notification_prefs (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  kind notif_kind NOT NULL, enabled bool NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, kind)
);
```

## Coverage map (requested entities → tables)

users → `users` · profiles → `profiles` · follows → `follows` · friendships → `friendships` · posts → `posts` · comments → `comments` · reactions → `reactions` · recipes → `recipes` · recipe ingredients → `recipe_ingredients` · recipe votes → `votes(subject_type='recipe')` · recipe saves → `saves` · recipe reviews → `recipe_reviews` · recipe corrections → `recipe_corrections` · meal plans → `meal_plans` · meal prep plans → `meal_prep_plans` + `meal_prep_items` · grocery lists → `grocery_lists` + `grocery_items` · foods → `foods` · food logs → `food_logs` (+ `water_logs`, `saved_meals`) · restaurants → `restaurants` · chains → `chains` · menu items → `menu_items` · menu item ratings → `menu_item_ratings` · restaurant requests → `restaurant_requests` (+ `go_to_orders`) · workouts → `workouts` · exercises → `exercises` · workout templates → `workouts(is_template)` · workout logs → `workout_logs` (+ `personal_records`) · workout saves → `saves` · workout reactions → `reactions` · progress entries → `progress_entries` · photos → `photos` + `media_attachments` · groups → `groups` · group memberships → `group_members` · challenges → `challenges` · challenge participants → `challenge_participants` · notifications → `notifications` (+ prefs) · reports → `reports` · moderation actions → `moderation_actions` (+ `content_warnings`) · badges → `badges` · user badges → `user_badges` (+ `streaks`, `reputation_events`, `tags`/`taggings`, `nutrition_targets`, `recipe_versions`, `blocks`).

Key deliberate choices:
- **Polymorphic interactions** (`votes`, `saves`, `reactions`, `comments`, `reports`, `taggings`) mean adding a new content type never requires new interaction tables.
- **Macro snapshots on `food_logs`**: editing a recipe never rewrites anyone's diary history.
- **`workout_logs.entries` and `workouts.structure` as JSONB**: set-by-set rows are write-once, read-whole documents; relational set rows would triple write volume for zero query benefit at this stage. `personal_records` extracts the queryable bits.
- **Symmetric friendship stored once** (`user_lo < user_hi`) — no dual-row consistency bugs.
- **Counters denormalized, events append-only**: rankings and reputation read cheap aggregates; the event/interaction rows remain the source of truth for recomputes.
