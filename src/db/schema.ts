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
} from "drizzle-orm/pg-core";

// Column names are derived via casing: "snake_case" (see db/client.ts + drizzle.config.ts).

// ─── identity ────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: text().notNull().default("user"), // user | moderator | admin
  reputation: integer().notNull().default(0),
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
    source: text().notNull().default("seed"), // seed | user | admin
    verified: boolean().notNull().default(false),
  },
  (t) => [index("foods_name_idx").on(t.name)],
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
    name: text().notNull(), // display snapshot
    servings: real().notNull().default(1),
    // macro snapshot at log time — editing a source never rewrites diary history
    calories: real().notNull(),
    proteinG: real().notNull(),
    carbsG: real().notNull(),
    fatG: real().notNull(),
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
