import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  smallint,
  primaryKey,
  index,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";

// Column names are derived via casing: "snake_case" (see db/client.ts + drizzle.config.ts).

// ─── identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: text().notNull().default("user"), // user | moderator | admin
  reputation: integer().notNull().default(0),
  isGuest: boolean().notNull().default(false), // anonymous session; claimed via settings (docs/08 §1a)
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

export const profiles = pgTable("profiles", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  username: text().notNull().unique(),
  displayName: text().notNull(),
  bio: text(),
  goal: text(), // fat_loss | muscle_gain | maintenance | recomp | performance | general_health | custom
  trackingStyle: text(), // strict_macro | calorie_only | protein_focused | habit | maintenance | performance | no_scale
  dietaryStyle: text(),
  activityLevel: text(), // sedentary | light | moderate | very | extra
  sex: text(), // male | female
  heightCm: real(),
  weightKg: real(),
  birthYear: integer(),
  units: text().notNull().default("imperial"), // metric | imperial — display/input only, storage stays metric
  visibility: text().notNull().default("public"),
  shareMacroGoals: boolean().notNull().default(false),
  onboardedAt: timestamp({ withTimezone: true }),
});

export const nutritionTargets = pgTable(
  "nutrition_targets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calories: integer().notNull(),
    proteinG: integer().notNull(),
    carbsG: integer().notNull(),
    fatG: integer().notNull(),
    isManual: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("targets_user_idx").on(t.userId, t.createdAt)],
);

// ─── social graph ────────────────────────────────────────────────────────────

export const follows = pgTable(
  "follows",
  {
    followerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId),
  ],
);

// ─── posts + polymorphic interactions (one social primitive) ────────────────

export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull().default("general"), // general | recipe | tip | question | progress | personal_record | meal_log_highlight
    body: text(),
    refType: text(), // recipe (more types later)
    refId: uuid(),
    groupId: uuid(), // group feed post; excluded from home feeds (FK added via groups table below)
    isRemoved: boolean().notNull().default(false), // moderation soft-hide; author sees a notice
    visibility: text().notNull().default("public"),
    commentCount: integer().notNull().default(0),
    reactionCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_author_idx").on(t.authorId, t.createdAt)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: text().notNull(), // post | recipe
    subjectId: uuid().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_subject_idx").on(t.subjectType, t.subjectId, t.createdAt)],
);

export const reactions = pgTable(
  "reactions",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    kind: text().notNull(), // like | strong | high_protein | macro_win | pr | meal_prep_win
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.subjectType, t.subjectId] }),
    index("reactions_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: text().notNull(), // recipe
    subjectId: uuid().notNull(),
    value: smallint().notNull(), // 1 | -1
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.subjectType, t.subjectId] }),
    index("votes_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

export const saves = pgTable(
  "saves",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.subjectType, t.subjectId] })],
);

// ─── foods + logging ─────────────────────────────────────────────────────────

export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text().notNull(),
    mimeType: text().notNull(),
    purpose: text().notNull(), // avatar | recipe | post | progress | review | workout
    width: integer(),
    height: integer(),
    isPrivate: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_user_idx").on(t.userId, t.createdAt), index("photos_purpose_idx").on(t.purpose)],
);

export const mediaAttachments = pgTable(
  "media_attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    photoId: uuid()
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_subject_idx").on(t.subjectType, t.subjectId)],
);

// FDA-label micronutrients (docs/10 §1) — sparse by design: null means "no data",
// same contract as fiberG/sodiumMg. Fresh builders per table (drizzle builders are stateful).
const microColumns = () => ({
  sugarG: real(),
  addedSugarG: real(),
  saturatedFatG: real(),
  cholesterolMg: real(),
  potassiumMg: real(),
  calciumMg: real(),
  ironMg: real(),
  vitaminAMcg: real(),
  vitaminCMg: real(),
  vitaminDMcg: real(),
});

export const foods = pgTable(
  "foods",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    brand: text(),
    servingDesc: text().notNull(), // "100 g", "1 large egg"
    servingGrams: real(),
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    fiberG: real(),
    sodiumMg: real(),
    ...microColumns(),
    barcode: text(), // EAN/UPC digits for scan lookup (docs/10 §2)
    source: text().notNull().default("seed"), // seed | user | admin | off_import
    verified: boolean().notNull().default(false),
  },
  (t) => [index("foods_name_idx").on(t.name), index("foods_barcode_idx").on(t.barcode)],
);

export const foodLogs = pgTable(
  "food_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logDate: date().notNull(), // YYYY-MM-DD
    mealSlot: text().notNull(), // breakfast | lunch | dinner | snack
    foodId: uuid().references(() => foods.id),
    recipeId: uuid().references(() => recipes.id),
    menuItemId: uuid().references(() => menuItems.id),
    name: text().notNull(), // display snapshot
    servings: real().notNull().default(1),
    // macro snapshot at log time — editing a source never rewrites diary history
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    fiberG: real(),
    sodiumMg: real(),
    ...microColumns(),
    loggedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("food_logs_user_date_idx").on(t.userId, t.logDate),
    index("food_logs_recipe_idx").on(t.recipeId),
  ],
);

export const waterLogs = pgTable(
  "water_logs",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logDate: date().notNull(),
    ml: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.logDate] })],
);

// ─── recipes ─────────────────────────────────────────────────────────────────

export const recipes = pgTable(
  "recipes",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    instructions: text().notNull(),
    servings: real().notNull().default(1),
    servingDesc: text(),
    // per-serving macros (denormalized for filters/sorts)
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    fiberG: real(),
    sodiumMg: real(),
    ...microColumns(),
    macroSource: text().notNull().default("creator_entered"), // ingredient_calculated | creator_entered | verified
    macroConfidence: real().notNull().default(0.3),
    prepMin: integer(),
    cookMin: integer(),
    difficulty: smallint(), // 1-5
    costCents: integer(),
    tags: text().array().notNull().default([]),
    // denormalized ranking counters
    upvotes: integer().notNull().default(0),
    downvotes: integer().notNull().default(0),
    saveCount: integer().notNull().default(0),
    logCount: integer().notNull().default(0),
    triedCount: integer().notNull().default(0),
    ratingSum: integer().notNull().default(0),
    ratingCount: integer().notNull().default(0),
    status: text().notNull().default("published"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recipes_author_idx").on(t.authorId, t.createdAt),
    index("recipes_protein_idx").on(t.proteinG, t.calories),
  ],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    foodId: uuid().references(() => foods.id),
    personalIngredientId: uuid().references(() => personalIngredients.id), // alternative link (docs/08 §1b)
    rawText: text().notNull(),
    grams: real(),
    position: smallint().notNull().default(0),
  },
  (t) => [index("ingredients_recipe_idx").on(t.recipeId)],
);

export const recipeReviews = pgTable(
  "recipe_reviews",
  {
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint(), // 1-5, nullable = "tried" without rating
    body: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.userId] })],
);

// Private, freeform, unverified — speeds up repeat recipe-building (docs/08 §1b).
// Additive to `foods`: still yields ingredient_calculated provenance, just not community-visible.
export const personalIngredients = pgTable(
  "personal_ingredients",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    servingDesc: text().notNull().default("100 g"),
    servingGrams: real().notNull().default(100),
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("personal_ingredients_user_idx").on(t.userId, t.name)],
);

// ─── restaurants (docs/06 §7) ────────────────────────────────────────────────

export const chains = pgTable("chains", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  emoji: text(), // lightweight logo stand-in until the media pipeline lands
  verified: boolean().notNull().default(false),
});

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid().primaryKey().defaultRandom(),
    chainId: uuid()
      .notNull()
      .references(() => chains.id, { onDelete: "cascade" }),
    name: text().notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    address: text(),
    source: text().notNull().default("seed"), // seed | admin | overpass
  },
  (t) => [index("restaurants_chain_idx").on(t.chainId), index("restaurants_geo_idx").on(t.lat, t.lng)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    chainId: uuid()
      .notNull()
      .references(() => chains.id, { onDelete: "cascade" }),
    name: text().notNull(),
    category: text(), // Entrees | Sides | Drinks | …
    kind: text().notNull().default("fixed"), // fixed | buildable
    comboGroup: text(), // entree|side pairing tag for combo recommendations (docs/06 §7c)
    // for kind='buildable' these are the default build; real macros come from options
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    fiberG: real(),
    sodiumMg: real(),
    ...microColumns(),
    macroSource: text().notNull().default("label_imported"),
    verified: boolean().notNull().default(true),
  },
  (t) => [index("menu_items_chain_idx").on(t.chainId)],
);

export const menuItemOptionGroups = pgTable(
  "menu_item_option_groups",
  {
    id: uuid().primaryKey().defaultRandom(),
    menuItemId: uuid()
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    name: text().notNull(), // "Base", "Protein", "Toppings"
    minChoices: smallint().notNull().default(0),
    maxChoices: smallint(), // null = unlimited; double protein = tap twice
    position: smallint().notNull().default(0),
  },
  (t) => [index("option_groups_item_idx").on(t.menuItemId)],
);

export const menuItemOptions = pgTable(
  "menu_item_options",
  {
    id: uuid().primaryKey().defaultRandom(),
    groupId: uuid()
      .notNull()
      .references(() => menuItemOptionGroups.id, { onDelete: "cascade" }),
    name: text().notNull(),
    portionDesc: text(), // "1 scoop (4 oz)"
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    sodiumMg: real(),
    isDefault: boolean().notNull().default(false),
    position: smallint().notNull().default(0),
  },
  (t) => [index("options_group_idx").on(t.groupId)],
);

export const goToOrders = pgTable(
  "go_to_orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chainId: uuid()
      .notNull()
      .references(() => chains.id, { onDelete: "cascade" }),
    name: text().notNull(),
    // [{menuItemId, optionIds?: string[], servings?: number}] — option ids for buildables
    items: jsonb().notNull(),
    // macro snapshot so lists render without re-summing options
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
    isPublic: boolean().notNull().default(true),
    logCount: integer().notNull().default(0), // "popular builds" ranking signal
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("go_to_orders_user_idx").on(t.userId), index("go_to_orders_chain_idx").on(t.chainId)],
);

// ─── progress + habits ───────────────────────────────────────────────────────

export const progressEntries = pgTable(
  "progress_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryDate: date().notNull(),
    weightKg: real(),
    bodyFatPct: real(),
    waistCm: real(),
    chestCm: real(),
    hipsCm: real(),
    armsCm: real(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("progress_user_date_idx").on(t.userId, t.entryDate)],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    emoji: text().notNull().default("✅"),
    isDefault: boolean().notNull().default(false),
    archived: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("habits_user_idx").on(t.userId)],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    logDate: date().notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.logDate] })],
);

// One row per fast; endedAt null while active (docs/10 §3)
export const fastingWindows = pgTable(
  "fasting_windows",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
    targetHours: real().notNull(),
  },
  (t) => [index("fasting_user_idx").on(t.userId, t.startedAt)],
);

// One row per night, keyed by wake-up date; times as local "HH:MM" strings so no
// timezone round-trip is needed — durationMin is the number analytics use (docs/10 §4)
export const sleepLogs = pgTable(
  "sleep_logs",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sleepDate: date().notNull(), // the morning you woke up
    bedTime: text().notNull(), // "23:15"
    wakeTime: text().notNull(), // "07:05"
    durationMin: integer().notNull(),
    quality: smallint(), // 1-5, optional
    source: text().notNull().default("manual"), // manual | fitbit | whoop | … (docs/10 §5)
  },
  (t) => [primaryKey({ columns: [t.userId, t.sleepDate] })],
);

// ─── feedback + admin import changelog ───────────────────────────────────────

export const feedback = pgTable("feedback", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
  body: text().notNull(),
  pageContext: text(),
  status: text().notNull().default("open"), // open | reviewed | actioned
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const nutritionImportBatches = pgTable("nutrition_import_batches", {
  id: uuid().primaryKey().defaultRandom(),
  uploadedBy: uuid()
    .notNull()
    .references(() => users.id),
  target: text().notNull(), // foods | menu_items
  filename: text().notNull(),
  rowCount: integer().notNull(),
  insertedCount: integer().notNull(),
  duplicateCount: integer().notNull().default(0),
  errorCount: integer().notNull().default(0),
  errors: jsonb(), // [{row, message}]
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ─── workouts (docs/03 §WORKOUTS) ────────────────────────────────────────────

export const exercises = pgTable("exercises", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  muscleGroups: text().array().notNull().default([]),
  equipment: text(), // barbell | dumbbell | machine | cable | bodyweight | other
  isBodyweight: boolean().notNull().default(false),
});

// structure/entries as JSONB: set rows are write-once, read-whole documents;
// personal_records extracts the queryable bits (docs/03 key choices)
export type WorkoutStructure = { exerciseId: string; sets: number; reps: string; notes?: string }[];
export type WorkoutLogEntries = { exerciseId: string; sets: { reps: number; weightKg: number | null }[] }[];

export const workouts = pgTable(
  "workouts",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }), // null = official template
    forkedFromId: uuid(),
    title: text().notNull(),
    description: text(),
    kind: text().notNull().default("strength"), // strength | cardio | mobility | mixed
    goal: text(),
    difficulty: smallint(), // 1-5
    estDurationMin: integer(),
    isTemplate: boolean().notNull().default(false), // official starter shelf
    structure: jsonb().notNull().$type<WorkoutStructure>(),
    saveCount: integer().notNull().default(0),
    completedCount: integer().notNull().default(0),
    status: text().notNull().default("published"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workouts_author_idx").on(t.authorId, t.createdAt)],
);

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: uuid().references(() => workouts.id), // null = freeform session
    performedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    durationMin: integer(),
    notes: text(),
    entries: jsonb().notNull().$type<WorkoutLogEntries>(),
  },
  (t) => [index("workout_logs_user_idx").on(t.userId, t.performedAt)],
);

export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    metric: text().notNull(), // e1rm | volume | reps
    value: real().notNull(),
    achievedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    workoutLogId: uuid().references(() => workoutLogs.id, { onDelete: "set null" }),
  },
  (t) => [index("prs_user_exercise_idx").on(t.userId, t.exerciseId, t.metric)],
);

// ─── grocery lists ───────────────────────────────────────────────────────────

export const groceryLists = pgTable("grocery_lists", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull().default("Groceries"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const groceryItems = pgTable(
  "grocery_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    listId: uuid()
      .notNull()
      .references(() => groceryLists.id, { onDelete: "cascade" }),
    name: text().notNull(),
    quantity: text(), // "450 g", "2"
    section: text(), // produce | protein | dairy | pantry | frozen | other
    estCostCents: integer(),
    purchased: boolean().notNull().default(false),
    sourceRecipeId: uuid().references(() => recipes.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("grocery_items_list_idx").on(t.listId, t.purchased)],
);

// ─── meal prep plans (docs/06 §6) ────────────────────────────────────────────

export const mealPrepPlans = pgTable(
  "meal_prep_plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    daysCovered: smallint(),
    totalServings: smallint().notNull().default(1),
    goal: text(),
    // per-serving macros + cost derived from member recipes (recomputed on edit)
    calories: real().notNull().default(0),
    proteinG: real().notNull().default(0),
    carbsG: real().notNull().default(0),
    fatG: real().notNull().default(0),
    costPerServingCents: integer(),
    prepMin: integer(),
    storageNotes: text(),
    upvotes: integer().notNull().default(0),
    downvotes: integer().notNull().default(0),
    saveCount: integer().notNull().default(0),
    status: text().notNull().default("published"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meal_prep_author_idx").on(t.authorId, t.createdAt)],
);

export const mealPrepItems = pgTable(
  "meal_prep_items",
  {
    planId: uuid()
      .notNull()
      .references(() => mealPrepPlans.id, { onDelete: "cascade" }),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    servings: real().notNull().default(1),
    position: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.planId, t.position] })],
);

// ─── groups & challenges (docs/05 §4–5) ──────────────────────────────────────

export const groups = pgTable("groups", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  description: text(),
  kind: text().notNull().default("goal"), // goal | diet | location | gym | interest
  memberCount: integer().notNull().default(0),
  createdBy: uuid()
    .notNull()
    .references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text().notNull().default("member"), // member | moderator | owner
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// A challenge = metric + target + window (+ optional group). Behavior-based only —
// never weight-loss-amount (docs/07 §4). Auto-scored metrics compute from existing logs.
export const challenges = pgTable(
  "challenges",
  {
    id: uuid().primaryKey().defaultRandom(),
    groupId: uuid().references(() => groups.id, { onDelete: "cascade" }), // null = global
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    title: text().notNull(),
    description: text(),
    metric: text().notNull(), // logged_days | protein_days | workouts | custom_checkin
    target: real().notNull(),
    unit: text().notNull().default("days"),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("challenges_group_idx").on(t.groupId), index("challenges_window_idx").on(t.endsOn)],
);

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    challengeId: uuid()
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    progress: real().notNull().default(0), // auto-scored metrics recompute on view; custom = check-ins
    lastCheckinOn: date(), // custom_checkin: one per day
    completedAt: timestamp({ withTimezone: true }),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.userId] })],
);

// ─── moderation (docs/07) ────────────────────────────────────────────────────

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectType: text().notNull(), // post | recipe | comment | user
    subjectId: uuid().notNull(),
    reason: text().notNull(), // inaccurate_macros | unsafe_advice | harassment | body_shaming | ed_content | spam | stolen_content | fake_transformation | medical_claim | other
    detail: text(),
    status: text().notNull().default("open"), // open | actioned | dismissed
    reviewedBy: uuid().references(() => users.id),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

export const moderationActions = pgTable("moderation_actions", {
  id: uuid().primaryKey().defaultRandom(),
  actorId: uuid()
    .notNull()
    .references(() => users.id),
  kind: text().notNull(), // remove_content | restore_content | add_warning_label | dismiss_report | auto_hide
  subjectType: text().notNull(),
  subjectId: uuid().notNull(),
  reportId: uuid().references(() => reports.id),
  reason: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const contentWarnings = pgTable(
  "content_warnings",
  {
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    kind: text().notNull(), // misinformation | unsafe_diet | unverified_macros
    note: text(),
    addedBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subjectType, t.subjectId, t.kind] })],
);
