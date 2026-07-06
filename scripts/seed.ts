/* Seeds the database: foods, demo users, recipes (ingredient-calculated macros),
 * votes/saves/reviews, posts, follows, and a pre-onboarded demo account with logs.
 * Run: npm run db:seed  (idempotent-ish: wipes and recreates demo content)
 * Targets local PGlite by default; with DATABASE_URL set it seeds that Postgres instead
 * (docs/09-deployment.md). Hosted safety: the full demo seed WIPES every table, so with
 * DATABASE_URL it requires --force-demo. For production bootstrap use --reference-only:
 * foods, restaurants, exercises, workout templates — insert-only, skips non-empty tables. */
import { mkdirSync } from "fs";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
const args = process.argv.slice(2);
const referenceOnly = args.includes("--reference-only");
if (DATABASE_URL && !referenceOnly && !args.includes("--force-demo")) {
  console.error(
    "DATABASE_URL is set — refusing the full demo seed, which WIPES every table.\n" +
      "  Production bootstrap:   npm run db:seed -- --reference-only\n" +
      "  Demo data, on purpose:  npm run db:seed -- --force-demo",
  );
  process.exit(1);
}

function makePglite() {
  mkdirSync("./.data", { recursive: true });
  const client = new PGlite("./.data/pglite");
  return { db: drizzlePglite(client, { schema, casing: "snake_case" }), close: () => client.close() };
}
type Db = ReturnType<typeof makePglite>["db"];
function makePg(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url });
  return {
    db: drizzlePg(pool, { schema, casing: "snake_case" }) as unknown as Db,
    close: async () => {
      await pool.end();
    },
  };
}
const { db, close: closeDb } = DATABASE_URL ? makePg(DATABASE_URL) : makePglite();
const {
  users, profiles, nutritionTargets, follows, posts, comments, reactions,
  votes, saves, foods, foodLogs, waterLogs, recipes, recipeIngredients, recipeReviews,
  chains, restaurants, menuItems, menuItemOptionGroups, menuItemOptions, goToOrders,
  progressEntries, habits, habitLogs,
  exercises, workouts, workoutLogs, personalRecords, mealPrepPlans, mealPrepItems,
  groups, groupMembers, challenges, challengeParticipants, reports,
} = schema;

// name, kcal, P, C, F, fiber, sugar, sat fat (g), sodium (mg) per 100 g
// (vitamins/minerals stay null in seed — barcode imports carry them, docs/10 §1-2)
const FOODS: [string, number, number, number, number, number, number, number, number][] = [
  ["Chicken breast, cooked", 165, 31, 0, 3.6, 0, 0, 1, 74],
  ["Chicken thigh, cooked", 209, 26, 0, 10.9, 0, 0, 3, 95],
  ["Ground turkey 93/7, cooked", 213, 27, 0, 11, 0, 0, 3, 78],
  ["Ground beef 90/10, cooked", 217, 26, 0, 12, 0, 0, 4.7, 75],
  ["Salmon, cooked", 206, 22, 0, 12, 0, 0, 2.5, 61],
  ["Tuna, canned in water", 116, 26, 0, 0.8, 0, 0, 0.2, 247],
  ["Shrimp, cooked", 99, 24, 0.2, 0.3, 0, 0, 0.1, 111],
  ["Egg, whole", 143, 12.6, 0.7, 9.5, 0, 0.4, 3.1, 142],
  ["Egg whites", 52, 11, 0.7, 0.2, 0, 0.7, 0, 166],
  ["Greek yogurt, nonfat", 59, 10, 3.6, 0.4, 0, 3.2, 0.1, 36],
  ["Cottage cheese, low-fat", 72, 12, 4.3, 1, 0, 2.7, 0.7, 330],
  ["Whey protein powder", 400, 80, 8, 6, 1, 6, 2, 200],
  ["Skim milk", 34, 3.4, 5, 0.1, 0, 5, 0.1, 42],
  ["Cheddar cheese", 403, 23, 3.1, 33, 0, 0.5, 21, 621],
  ["Mozzarella, part-skim", 254, 24, 3, 16, 0, 1.2, 10, 619],
  ["White rice, cooked", 130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 1],
  ["Brown rice, cooked", 112, 2.6, 24, 0.9, 1.8, 0.4, 0.2, 5],
  ["Quinoa, cooked", 120, 4.4, 21, 1.9, 2.8, 0.9, 0.2, 7],
  ["Oats, dry", 379, 13, 68, 6.5, 10.6, 1, 1.1, 2],
  ["Whole wheat bread", 247, 13, 41, 3.4, 6, 4.3, 0.6, 450],
  ["Flour tortilla", 306, 8.2, 49, 8, 3, 2, 2, 750],
  ["Corn tortilla", 218, 5.7, 45, 2.9, 6.3, 0.9, 0.4, 45],
  ["Pasta, cooked", 158, 5.8, 31, 0.9, 1.8, 0.6, 0.2, 1],
  ["Sweet potato, baked", 90, 2, 21, 0.2, 3.3, 6.5, 0, 36],
  ["White potato, baked", 93, 2.5, 21, 0.1, 2.1, 1.2, 0, 10],
  ["Black beans, cooked", 132, 8.9, 24, 0.5, 8.7, 0.3, 0.1, 1],
  ["Chickpeas, cooked", 164, 8.9, 27, 2.6, 7.6, 4.8, 0.3, 7],
  ["Lentils, cooked", 116, 9, 20, 0.4, 7.9, 1.8, 0.1, 2],
  ["Broccoli", 34, 2.8, 7, 0.4, 2.6, 1.7, 0.1, 33],
  ["Spinach", 23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 79],
  ["Bell pepper", 26, 1, 6, 0.3, 1.7, 4.2, 0.1, 4],
  ["Onion", 40, 1.1, 9.3, 0.1, 1.7, 4.2, 0, 4],
  ["Tomato", 18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 5],
  ["Cucumber", 15, 0.7, 3.6, 0.1, 0.5, 1.7, 0, 2],
  ["Avocado", 160, 2, 8.5, 14.7, 6.7, 0.7, 2.1, 7],
  ["Banana", 89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 1],
  ["Blueberries", 57, 0.7, 14.5, 0.3, 2.4, 10, 0, 1],
  ["Strawberries", 32, 0.7, 7.7, 0.3, 2, 4.9, 0, 1],
  ["Apple", 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 1],
  ["Olive oil", 884, 0, 0, 100, 0, 0, 14, 2],
  ["Butter", 717, 0.9, 0.1, 81, 0, 0.1, 51, 576],
  ["Peanut butter", 588, 25, 20, 50, 6, 9, 10, 430],
  ["Almonds", 579, 21, 22, 50, 12.5, 4.4, 3.8, 1],
  ["Honey", 304, 0.3, 82, 0, 0.2, 82, 0, 4],
  ["Soy sauce", 53, 8.1, 4.9, 0.6, 0.8, 0.4, 0.1, 5490],
  ["Salsa", 36, 1.5, 7, 0.2, 1.4, 4, 0, 711],
  ["Marinara sauce", 50, 1.4, 8, 1.5, 1.8, 5, 0.2, 430],
  ["Maple syrup", 260, 0, 67, 0.1, 0, 60, 0, 12],
  ["Feta cheese", 264, 14, 4.1, 21, 0, 4.1, 15, 917],
];

type Ing = [foodName: string, grams: number];
type SeedRecipe = {
  author: string;
  name: string;
  description: string;
  instructions: string;
  servings: number;
  servingDesc?: string;
  prepMin: number;
  cookMin: number;
  difficulty: number;
  costCents: number;
  tags: string[];
  ingredients: Ing[];
};

const RECIPES: SeedRecipe[] = [
  {
    author: "chef_maria",
    name: "Meal Prep Chicken Burrito Bowls",
    description: "The classic cutting staple — five bowls, one pan, macros that actually fit.",
    instructions:
      "1. Season chicken with cumin, chili powder, garlic, salt.\n2. Sear in a hot pan until 74°C internal, rest, then slice.\n3. Cook rice; drain and rinse black beans.\n4. Assemble bowls: rice base, beans, chicken, peppers, salsa.\n5. Fridge up to 4 days. Add avocado fresh on the day you eat it.",
    servings: 5,
    servingDesc: "1 bowl (~450g)",
    prepMin: 15, cookMin: 30, difficulty: 2, costCents: 320,
    tags: ["high-protein", "meal-prep", "cutting", "budget", "lunch"],
    ingredients: [
      ["Chicken breast, cooked", 750], ["White rice, cooked", 900], ["Black beans, cooked", 400],
      ["Bell pepper", 300], ["Salsa", 250], ["Avocado", 150],
    ],
  },
  {
    author: "chef_maria",
    name: "10-Minute Egg White Scramble Wrap",
    description: "40g of protein before your first meeting.",
    instructions:
      "1. Scramble egg whites + 1 whole egg over medium heat.\n2. Warm the tortilla, layer spinach, add eggs and feta.\n3. Roll tight, toast seam-side down 60 seconds.",
    servings: 1,
    servingDesc: "1 wrap",
    prepMin: 3, cookMin: 7, difficulty: 1, costCents: 210,
    tags: ["high-protein", "breakfast", "quick", "cutting"],
    ingredients: [
      ["Egg whites", 200], ["Egg, whole", 50], ["Flour tortilla", 60], ["Spinach", 40], ["Feta cheese", 25],
    ],
  },
  {
    author: "chef_maria",
    name: "Protein Overnight Oats",
    description: "Dessert-tier breakfast that hits 35g protein. Mix it the night before.",
    instructions:
      "1. Stir oats, whey, and milk in a jar.\n2. Fridge overnight.\n3. Top with blueberries and a drizzle of honey before eating.",
    servings: 1,
    servingDesc: "1 jar",
    prepMin: 5, cookMin: 0, difficulty: 1, costCents: 180,
    tags: ["high-protein", "breakfast", "no-cook", "meal-prep", "vegetarian"],
    ingredients: [
      ["Oats, dry", 60], ["Whey protein powder", 30], ["Skim milk", 200], ["Blueberries", 80], ["Honey", 10],
    ],
  },
  {
    author: "prep_king",
    name: "Turkey Chili (Big Batch)",
    description: "8 servings, freezes perfectly, ~$2.10 a bowl. The bulk-cut crossover king.",
    instructions:
      "1. Brown turkey with onion.\n2. Add beans, tomatoes, marinara, chili powder, cumin, paprika.\n3. Simmer 45 min. Salt to taste.\n4. Portion into 8 containers; fridge 4 days or freeze 3 months.",
    servings: 8,
    servingDesc: "1 bowl (~400g)",
    prepMin: 15, cookMin: 60, difficulty: 2, costCents: 210,
    tags: ["high-protein", "meal-prep", "budget", "dinner", "bulking"],
    ingredients: [
      ["Ground turkey 93/7, cooked", 900], ["Black beans, cooked", 500], ["Lentils, cooked", 300],
      ["Tomato", 400], ["Marinara sauce", 400], ["Onion", 200], ["Bell pepper", 200],
    ],
  },
  {
    author: "prep_king",
    name: "Air Fryer Salmon & Sweet Potato",
    description: "12 minutes in the air fryer. Restaurant dinner, cutting macros.",
    instructions:
      "1. Cube sweet potato, toss in half the oil, air fry 200°C for 12 min.\n2. Rub salmon with remaining oil and paprika, add at the 5-min mark.\n3. Steam broccoli. Plate everything, squeeze lemon over.",
    servings: 2,
    servingDesc: "1 plate",
    prepMin: 10, cookMin: 12, difficulty: 1, costCents: 550,
    tags: ["high-protein", "dinner", "quick", "air-fryer", "cutting"],
    ingredients: [
      ["Salmon, cooked", 300], ["Sweet potato, baked", 400], ["Broccoli", 300], ["Olive oil", 15],
    ],
  },
  {
    author: "prep_king",
    name: "Beef & Rice Power Bowls",
    description: "Bulk fuel. 5 minutes of assembly per bowl all week.",
    instructions:
      "1. Brown the beef, deglaze with soy sauce.\n2. Portion rice, beef, and broccoli into 4 containers.\n3. Microwave 2 min to reheat. Sriracha optional but correct.",
    servings: 4,
    servingDesc: "1 bowl",
    prepMin: 10, cookMin: 20, difficulty: 1, costCents: 380,
    tags: ["high-protein", "bulking", "meal-prep", "dinner", "budget"],
    ingredients: [
      ["Ground beef 90/10, cooked", 600], ["White rice, cooked", 800], ["Broccoli", 400], ["Soy sauce", 30],
    ],
  },
  {
    author: "coach_dan",
    name: "Post-Workout Protein Pancakes",
    description: "Banana + whey pancakes. No flour, no excuses.",
    instructions:
      "1. Blend banana, eggs, whey, and oats into a batter.\n2. Cook 3 pancakes per side on medium.\n3. Top with strawberries and maple syrup.",
    servings: 1,
    servingDesc: "3 pancakes",
    prepMin: 5, cookMin: 10, difficulty: 2, costCents: 240,
    tags: ["high-protein", "breakfast", "vegetarian"],
    ingredients: [
      ["Banana", 120], ["Egg, whole", 100], ["Whey protein powder", 30], ["Oats, dry", 40],
      ["Strawberries", 80], ["Maple syrup", 15],
    ],
  },
  {
    author: "coach_dan",
    name: "Greek Yogurt Protein Bowl",
    description: "The laziest 45g of protein in existence. Zero cooking.",
    instructions:
      "1. Yogurt in bowl.\n2. Stir in whey until smooth.\n3. Top with berries, almonds, honey.",
    servings: 1,
    servingDesc: "1 bowl",
    prepMin: 4, cookMin: 0, difficulty: 1, costCents: 260,
    tags: ["high-protein", "no-cook", "snack", "quick", "vegetarian", "cutting"],
    ingredients: [
      ["Greek yogurt, nonfat", 300], ["Whey protein powder", 15], ["Blueberries", 70],
      ["Almonds", 15], ["Honey", 10],
    ],
  },
  {
    author: "coach_dan",
    name: "Chicken Fajita Skillet",
    description: "One pan, family-approved, macro-tracked.",
    instructions:
      "1. Slice chicken thin, toss with fajita seasoning.\n2. Sear hard in oil, remove.\n3. Char peppers and onions, return chicken.\n4. Serve over rice or in corn tortillas (log those separately).",
    servings: 3,
    servingDesc: "1 portion",
    prepMin: 12, cookMin: 15, difficulty: 2, costCents: 340,
    tags: ["high-protein", "dinner", "cutting", "quick"],
    ingredients: [
      ["Chicken breast, cooked", 500], ["Bell pepper", 300], ["Onion", 150], ["Olive oil", 15],
    ],
  },
  {
    author: "chef_maria",
    name: "Tuna Avocado Power Toast",
    description: "Pantry protein meets good fats. Lunch in 6 minutes flat.",
    instructions:
      "1. Mash avocado on toasted bread.\n2. Mix drained tuna with a squeeze of lemon and pepper.\n3. Pile tuna on top, cucumber slices on the side.",
    servings: 1,
    servingDesc: "2 slices",
    prepMin: 6, cookMin: 0, difficulty: 1, costCents: 280,
    tags: ["high-protein", "lunch", "no-cook", "quick", "cutting"],
    ingredients: [
      ["Tuna, canned in water", 120], ["Whole wheat bread", 70], ["Avocado", 60], ["Cucumber", 80],
    ],
  },
];

const POSTS: { author: string; type: string; body: string }[] = [
  { author: "coach_dan", type: "tip", body: "Protein rule of thumb nobody wants to hear: if breakfast is under 30g, you'll spend the whole day catching up. Front-load it." },
  { author: "prep_king", type: "tip", body: "Sunday prep in 90 minutes: one protein in the oven, one in a pan, rice cooker going, veg in the air fryer. Parallel > perfect." },
  { author: "chef_maria", type: "general", body: "Hot take: bland meal prep is a recipe problem, not a discipline problem. Season like you mean it — spices are basically free calories." },
  { author: "coach_dan", type: "personal_record", body: "Client PR day 🏆 — 6 months of showing up: squat 100→140kg while dropping 8kg bodyweight. Consistency beats intensity, every time." },
  { author: "prep_king", type: "question", body: "Chest freezer people: how long do you actually keep frozen chili before it gets weird? Asking for my 16 containers." },
  { author: "chef_maria", type: "progress", body: "12 weeks of logging every day 📈 — down 6kg, protein average 152g/day. This app's streak flame is genuinely doing psychological damage (the good kind)." },
];

async function seedFoods() {
  const foodRows = await db
    .insert(foods)
    .values(
      FOODS.map(([name, calories, proteinG, carbsG, fatG, fiberG, sugarG, saturatedFatG, sodiumMg]) => ({
        name, calories, proteinG, carbsG, fatG, fiberG, sugarG, saturatedFatG, sodiumMg,
        servingDesc: "100 g", servingGrams: 100, source: "seed", verified: true,
      })),
    )
    .returning();
  console.log(`  ${foodRows.length} foods`);
  return new Map(foodRows.map((f) => [f.name, f]));
}

async function seedChainsAndMenus() {
  // Fixed-item macros: [name, category, kcal, P, C, F, sodiumMg?, comboGroup?]
  type FixedDef = [string, string, number, number, number, number, number?, ("entree" | "side")?];
  // Option macros: [name, kcal, P, C, F, isDefault?, portionDesc?]
  type OptDef = [string, number, number, number, number, (0 | 1)?, string?];
  type GroupDef = { name: string; min: number; max: number | null; options: OptDef[] };
  type ChainDef = {
    name: string;
    emoji: string;
    locations: [string, number, number][]; // name, lat, lng (around 30.2672,-97.7431)
    fixed?: FixedDef[];
    buildable?: { name: string; category: string; groups: GroupDef[] };
  };

  const CHAINS: ChainDef[] = [
    {
      name: "Chipotle",
      emoji: "🌯",
      locations: [
        ["Chipotle — Congress Ave", 30.2668, -97.7428],
        ["Chipotle — MLK Blvd", 30.2815, -97.7385],
      ],
      buildable: {
        name: "Burrito Bowl",
        category: "Build your own",
        groups: [
          {
            name: "Base", min: 1, max: 2,
            options: [
              ["White rice", 210, 4, 40, 4, 1, "1 scoop (4 oz)"],
              ["Brown rice", 210, 4, 36, 6, 0, "1 scoop (4 oz)"],
              ["Supergreens lettuce", 15, 1, 3, 0, 0, "1 portion"],
            ],
          },
          {
            name: "Protein", min: 1, max: 2,
            options: [
              ["Chicken", 180, 32, 0, 7, 1, "4 oz"],
              ["Steak", 150, 21, 1, 6, 0, "4 oz"],
              ["Barbacoa", 170, 24, 2, 7, 0, "4 oz"],
              ["Carnitas", 210, 23, 0, 12, 0, "4 oz"],
              ["Sofritas", 150, 8, 9, 10, 0, "4 oz"],
            ],
          },
          {
            name: "Beans", min: 0, max: 1,
            options: [
              ["Black beans", 130, 8, 22, 1.5, 1, "1 scoop"],
              ["Pinto beans", 130, 8, 21, 1.5, 0, "1 scoop"],
            ],
          },
          {
            name: "Toppings", min: 0, max: null,
            options: [
              ["Fajita veggies", 20, 1, 5, 0],
              ["Fresh tomato salsa", 25, 0, 5, 0, 1],
              ["Roasted chili-corn salsa", 80, 3, 16, 1.5],
              ["Tomatillo green salsa", 15, 0, 4, 0],
              ["Cheese", 110, 6, 1, 8],
              ["Sour cream", 110, 2, 2, 9],
              ["Guacamole", 230, 2, 8, 22],
              ["Queso blanco", 120, 5, 4, 9],
            ],
          },
        ],
      },
      fixed: [["Chips & Guacamole", "Sides", 770, 9, 82, 47, 850]],
    },
    {
      name: "Subway",
      emoji: "🥪",
      locations: [["Subway — 6th Street", 30.2681, -97.7405]],
      buildable: {
        name: '6" Sub',
        category: "Build your own",
        groups: [
          {
            name: "Bread", min: 1, max: 1,
            options: [
              ["Italian bread", 200, 7, 38, 2, 1],
              ["9-Grain wheat", 180, 8, 36, 2],
              ["Italian herbs & cheese", 240, 9, 40, 5],
              ["Flatbread", 230, 8, 40, 5],
            ],
          },
          {
            name: "Protein", min: 1, max: 2,
            options: [
              ["Turkey breast", 50, 10, 2, 1, 1],
              ["Ham", 60, 10, 3, 1.5],
              ["Roast beef", 70, 13, 1, 1.5],
              ["Rotisserie chicken", 80, 16, 2, 1.5],
              ["Tuna", 250, 10, 1, 22],
              ["Steak", 110, 17, 3, 4],
            ],
          },
          {
            name: "Cheese", min: 0, max: 1,
            options: [
              ["American", 40, 2, 1, 3.5],
              ["Provolone", 50, 4, 0, 4],
              ["Pepper jack", 50, 3, 0, 4],
            ],
          },
          {
            name: "Veggies", min: 0, max: null,
            options: [
              ["Lettuce", 3, 0, 1, 0, 1],
              ["Tomatoes", 5, 0, 1, 0, 1],
              ["Cucumbers", 3, 0, 1, 0],
              ["Green peppers", 3, 0, 1, 0],
              ["Red onions", 5, 0, 1, 0],
              ["Spinach", 3, 0, 1, 0],
              ["Pickles", 0, 0, 0, 0],
              ["Jalapeños", 2, 0, 1, 0],
            ],
          },
          {
            name: "Sauce", min: 0, max: 2,
            options: [
              ["Mayonnaise", 100, 0, 0, 11],
              ["Ranch", 110, 0, 1, 11],
              ["Sweet onion", 40, 0, 9, 0],
              ["Yellow mustard", 10, 1, 1, 0],
              ["Oil & vinegar", 45, 0, 0, 5],
            ],
          },
        ],
      },
    },
    {
      name: "McDonald's",
      emoji: "🍟",
      locations: [
        ["McDonald's — Guadalupe St", 30.2712, -97.7455],
        ["McDonald's — I-35 Frontage", 30.2601, -97.7362],
      ],
      fixed: [
        ["Big Mac", "Burgers", 590, 25, 46, 34, 1050, "entree"],
        ["Quarter Pounder with Cheese", "Burgers", 520, 30, 42, 26, 1140, "entree"],
        ["McDouble", "Burgers", 400, 22, 33, 20, 920, "entree"],
        ["McChicken", "Chicken", 400, 14, 39, 21, 560, "entree"],
        ["10 pc Chicken McNuggets", "Chicken", 410, 23, 26, 24, 900, "entree"],
        ["Filet-O-Fish", "Fish", 390, 16, 39, 19, 580, "entree"],
        ["Small French Fries", "Sides", 230, 3, 29, 11, 190, "side"],
        ["Medium French Fries", "Sides", 320, 5, 43, 15, 260, "side"],
        ["Apple Slices", "Sides", 15, 0, 4, 0, 0, "side"],
        ["Side Salad", "Sides", 15, 1, 3, 0, 10, "side"],
      ],
    },
    {
      name: "Chick-fil-A",
      emoji: "🐔",
      locations: [["Chick-fil-A — Lamar Blvd", 30.2645, -97.7521]],
      fixed: [
        ["Grilled Chicken Sandwich", "Entrees", 390, 28, 44, 12, 820, "entree"],
        ["Chicken Sandwich", "Entrees", 420, 26, 41, 18, 1400, "entree"],
        ["12 ct Grilled Nuggets", "Entrees", 200, 38, 2, 4.5, 720, "entree"],
        ["Grilled Chicken Cool Wrap", "Entrees", 350, 42, 29, 14, 960, "entree"],
        ["Spicy Southwest Salad (grilled)", "Salads", 450, 33, 27, 23, 900, "entree"],
        ["Medium Waffle Fries", "Sides", 420, 5, 45, 24, 240, "side"],
        ["Fruit Cup", "Sides", 60, 1, 15, 0, 0, "side"],
        ["Kale Crunch Side", "Sides", 120, 3, 14, 7, 140, "side"],
        ["Side Salad", "Sides", 160, 3, 8, 13, 125, "side"],
      ],
    },
    {
      name: "Sweetgreen",
      emoji: "🥗",
      locations: [["Sweetgreen — 2nd Street District", 30.2652, -97.7469]],
      buildable: {
        name: "Custom Bowl",
        category: "Build your own",
        groups: [
          {
            name: "Base", min: 1, max: 2,
            options: [
              ["Chopped romaine", 15, 1, 3, 0, 1],
              ["Baby spinach", 10, 1, 1, 0],
              ["Wild rice", 210, 6, 35, 4],
              ["Warm quinoa", 250, 6, 40, 7],
            ],
          },
          {
            name: "Protein", min: 1, max: 2,
            options: [
              ["Roasted chicken", 150, 26, 1, 5, 1, "4 oz"],
              ["Blackened chicken thigh", 220, 20, 2, 15, 0, "4 oz"],
              ["Roasted tofu", 150, 11, 5, 10],
              ["Hard-boiled egg", 140, 12, 1, 9, 0, "2 eggs"],
            ],
          },
          {
            name: "Toppings", min: 0, max: null,
            options: [
              ["Roasted sweet potatoes", 100, 1, 20, 2],
              ["Chickpeas", 80, 3, 12, 2],
              ["Avocado", 90, 1, 5, 8, 1],
              ["Goat cheese", 80, 5, 1, 6],
              ["Almonds", 100, 3, 3, 9],
              ["Tomatoes", 10, 0, 2, 0, 1],
              ["Cucumbers", 5, 0, 1, 0],
            ],
          },
          {
            name: "Dressing", min: 0, max: 1,
            options: [
              ["Green goddess ranch", 130, 1, 3, 13],
              ["Balsamic vinaigrette", 120, 0, 5, 11],
              ["Lime cilantro jalapeño vinaigrette", 80, 0, 2, 8, 1],
              ["Lemon squeeze", 5, 0, 1, 0],
            ],
          },
        ],
      },
    },
  ];

  const chainIdByName = new Map<string, string>();
  const buildableByChain = new Map<string, { itemId: string; optionIdByName: Map<string, string> }>();
  let itemCount = 0;
  for (const c of CHAINS) {
    const [chain] = await db.insert(chains).values({ name: c.name, emoji: c.emoji, verified: true }).returning();
    chainIdByName.set(c.name, chain.id);
    await db.insert(restaurants).values(
      c.locations.map(([name, lat, lng]) => ({ chainId: chain.id, name, lat, lng, source: "seed" })),
    );
    for (const [name, category, calories, proteinG, carbsG, fatG, sodiumMg, comboGroup] of c.fixed ?? []) {
      await db.insert(menuItems).values({
        chainId: chain.id, name, category, kind: "fixed",
        calories, proteinG, carbsG, fatG, sodiumMg: sodiumMg ?? null, comboGroup: comboGroup ?? null,
      });
      itemCount++;
    }
    if (c.buildable) {
      // menu_items row carries the default-build macros
      const defaults = c.buildable.groups.flatMap((g) => g.options.filter((o) => o[5] === 1));
      const sum = (i: 1 | 2 | 3 | 4) => defaults.reduce((a, o) => a + o[i], 0);
      const [item] = await db
        .insert(menuItems)
        .values({
          chainId: chain.id, name: c.buildable.name, category: c.buildable.category, kind: "buildable",
          calories: sum(1), proteinG: sum(2), carbsG: sum(3), fatG: sum(4),
        })
        .returning();
      itemCount++;
      const optionIdByName = new Map<string, string>();
      for (let gi = 0; gi < c.buildable.groups.length; gi++) {
        const g = c.buildable.groups[gi];
        const [group] = await db
          .insert(menuItemOptionGroups)
          .values({ menuItemId: item.id, name: g.name, minChoices: g.min, maxChoices: g.max, position: gi })
          .returning();
        for (let oi = 0; oi < g.options.length; oi++) {
          const [name, calories, proteinG, carbsG, fatG, isDefault, portionDesc] = g.options[oi];
          const [opt] = await db
            .insert(menuItemOptions)
            .values({
              groupId: group.id, name, portionDesc: portionDesc ?? null,
              calories, proteinG, carbsG, fatG, isDefault: isDefault === 1, position: oi,
            })
            .returning();
          optionIdByName.set(name, opt.id);
        }
      }
      buildableByChain.set(c.name, { itemId: item.id, optionIdByName });
    }
  }
  console.log(`  ${CHAINS.length} chains, ${itemCount} menu items`);
  return { chainIdByName, buildableByChain };
}

async function seedExercises() {
  const EXERCISES: [name: string, muscles: string[], equipment: string, bodyweight?: 1, activityType?: string][] = [
    ["Barbell Back Squat", ["quads", "glutes"], "barbell"],
    ["Front Squat", ["quads", "core"], "barbell"],
    ["Barbell Bench Press", ["chest", "triceps"], "barbell"],
    ["Incline Dumbbell Press", ["chest", "shoulders"], "dumbbell"],
    ["Deadlift", ["hamstrings", "back"], "barbell"],
    ["Romanian Deadlift", ["hamstrings", "glutes"], "barbell"],
    ["Overhead Press", ["shoulders", "triceps"], "barbell"],
    ["Barbell Row", ["back", "biceps"], "barbell"],
    ["Lat Pulldown", ["back", "biceps"], "cable"],
    ["Pull-up", ["back", "biceps"], "bodyweight", 1],
    ["Push-up", ["chest", "triceps"], "bodyweight", 1],
    ["Dip", ["chest", "triceps"], "bodyweight", 1],
    ["Dumbbell Lunge", ["quads", "glutes"], "dumbbell"],
    ["Leg Press", ["quads", "glutes"], "machine"],
    ["Leg Curl", ["hamstrings"], "machine"],
    ["Calf Raise", ["calves"], "machine"],
    ["Dumbbell Curl", ["biceps"], "dumbbell"],
    ["Triceps Pushdown", ["triceps"], "cable"],
    ["Lateral Raise", ["shoulders"], "dumbbell"],
    ["Face Pull", ["rear delts", "upper back"], "cable"],
    ["Plank", ["core"], "bodyweight", 1],
    ["Hanging Leg Raise", ["core"], "bodyweight", 1],
    ["Hip Thrust", ["glutes"], "barbell"],
    ["Seated Cable Row", ["back"], "cable"],
    ["Goblet Squat", ["quads", "glutes"], "dumbbell"],
    ["Farmer's Carry", ["grip", "core"], "dumbbell"],
    ["Outdoor Run", ["cardio"], "outdoor", undefined, "outdoor_run"],
    ["Treadmill Run", ["cardio"], "machine", undefined, "treadmill_run"],
    ["Outdoor Walk", ["cardio"], "outdoor", undefined, "walk"],
    ["Hike", ["cardio", "glutes"], "outdoor", undefined, "hike"],
    ["Rowing Machine", ["cardio", "full body"], "machine", undefined, "rowing"],
    ["Stationary Bike", ["cardio", "quads"], "machine", undefined, "stationary_bike"],
    ["Outdoor Bike", ["cardio", "quads"], "outdoor", undefined, "outdoor_bike"],
    ["Elliptical", ["cardio"], "machine", undefined, "elliptical"],
    ["Mobility Session", ["mobility"], "bodyweight", 1, "mobility"],
    ["Generic Cardio", ["cardio"], "other", undefined, "generic_cardio"],
  ];
  const exerciseRows = await db
    .insert(exercises)
    .values(EXERCISES.map(([name, muscleGroups, equipment, bw, activityType]) => ({ name, muscleGroups, equipment, isBodyweight: bw === 1, activityType: activityType ?? "strength" })))
    .returning();
  const exByName = new Map(exerciseRows.map((e) => [e.name, e]));
  console.log(`  ${exByName.size} exercises`);
  return exByName;
}

async function ensureWorkoutActivities() {
  const activityRows = [
    { name: "Outdoor Run", muscleGroups: ["cardio"], equipment: "outdoor", activityType: "outdoor_run" },
    { name: "Treadmill Run", muscleGroups: ["cardio"], equipment: "machine", activityType: "treadmill_run" },
    { name: "Outdoor Walk", muscleGroups: ["cardio"], equipment: "outdoor", activityType: "walk" },
    { name: "Hike", muscleGroups: ["cardio", "glutes"], equipment: "outdoor", activityType: "hike" },
    { name: "Rowing Machine", muscleGroups: ["cardio", "full body"], equipment: "machine", activityType: "rowing" },
    { name: "Stationary Bike", muscleGroups: ["cardio", "quads"], equipment: "machine", activityType: "stationary_bike" },
    { name: "Outdoor Bike", muscleGroups: ["cardio", "quads"], equipment: "outdoor", activityType: "outdoor_bike" },
    { name: "Elliptical", muscleGroups: ["cardio"], equipment: "machine", activityType: "elliptical" },
    { name: "Mobility Session", muscleGroups: ["mobility"], equipment: "bodyweight", isBodyweight: true, activityType: "mobility" },
    { name: "Generic Cardio", muscleGroups: ["cardio"], equipment: "other", activityType: "generic_cardio" },
  ];
  const existing = new Map((await db.select().from(exercises)).map((e) => [e.name, e]));
  let inserted = 0;
  for (const row of activityRows) {
    if (existing.has(row.name)) {
      await db
        .update(exercises)
        .set({
          muscleGroups: row.muscleGroups,
          equipment: row.equipment,
          isBodyweight: row.isBodyweight ?? false,
          activityType: row.activityType,
        })
        .where(eq(exercises.name, row.name));
    } else {
      await db.insert(exercises).values({
        name: row.name,
        muscleGroups: row.muscleGroups,
        equipment: row.equipment,
        isBodyweight: row.isBodyweight ?? false,
        activityType: row.activityType,
      });
      inserted++;
    }
  }
  const rows = await db.select().from(exercises);
  console.log(`  exercises: activity rows ready (${inserted} inserted)`);
  return new Map(rows.map((e) => [e.name, e]));
}

async function seedWorkouts(
  exByName: Awaited<ReturnType<typeof seedExercises>>,
  authorIdFor: ((username: string) => string) | null, // null = seed official templates only
) {
  const ex = (name: string) => {
    const row = exByName.get(name);
    if (!row) throw new Error(`Seed exercise missing: ${name}`);
    return row.id;
  };
  type WDef = {
    author: string | null; // null = official template
    title: string; description: string; kind: string; difficulty: number; est: number;
    structure: (
      | [exercise: string, sets: number, reps: string]
      | { exercise: string; sets?: number; reps?: string; duration?: number; distanceM?: number; notes?: string }
    )[];
    completed?: number; saves?: number;
  };
  const WORKOUTS: WDef[] = [
    {
      author: null, title: "Full Body Starter A", kind: "strength", difficulty: 1, est: 45,
      description: "Three compound lifts, three accessories. Run A/B alternating, 3 days a week.",
      structure: [["Barbell Back Squat", 3, "5"], ["Barbell Bench Press", 3, "5"], ["Barbell Row", 3, "8"], ["Plank", 3, "45s"], ["Dumbbell Curl", 2, "12"], ["Calf Raise", 3, "15"]],
    },
    {
      author: null, title: "Full Body Starter B", kind: "strength", difficulty: 1, est: 45,
      description: "The B day: hinge + press + pull. Pairs with Starter A.",
      structure: [["Deadlift", 3, "5"], ["Overhead Press", 3, "5"], ["Lat Pulldown", 3, "10"], ["Dumbbell Lunge", 3, "10"], ["Face Pull", 3, "15"]],
    },
    {
      author: null, title: "Push Day (PPL)", kind: "strength", difficulty: 3, est: 60,
      description: "Chest / shoulders / triceps volume day from the classic PPL split.",
      structure: [["Barbell Bench Press", 4, "6-8"], ["Overhead Press", 3, "8-10"], ["Incline Dumbbell Press", 3, "10-12"], ["Lateral Raise", 4, "12-15"], ["Triceps Pushdown", 3, "12-15"], ["Dip", 3, "AMRAP"]],
    },
    {
      author: null, title: "Beginner 5K Run/Walk", kind: "cardio", difficulty: 1, est: 35,
      description: "Easy intervals toward a 5K: run what you can, walk before form falls apart.",
      structure: [{ exercise: "Outdoor Run", duration: 35, distanceM: 5000, notes: "Alternate easy running and brisk walking." }],
    },
    {
      author: null, title: "Treadmill Intervals", kind: "cardio", difficulty: 2, est: 30,
      description: "Warm up, alternate controlled pushes with easy recovery, cool down.",
      structure: [{ exercise: "Treadmill Run", duration: 30, notes: "10 min easy, 8 x 1 min fast / 1 min easy, cool down." }],
    },
    {
      author: null, title: "2K Row Benchmark", kind: "cardio", difficulty: 3, est: 12,
      description: "Classic rowing benchmark. Log meters and time; MacroVerse tracks 2K and split PRs.",
      structure: [{ exercise: "Rowing Machine", duration: 10, distanceM: 2000, notes: "Record total time and average stroke rate." }],
    },
    {
      author: null, title: "Zone 2 Bike", kind: "cardio", difficulty: 1, est: 45,
      description: "Steady aerobic ride. Keep effort conversational.",
      structure: [{ exercise: "Stationary Bike", duration: 45, notes: "RPE 4-6, smooth cadence." }],
    },
    {
      author: null, title: "Full Body Strength + Cardio Finisher", kind: "mixed", difficulty: 2, est: 55,
      description: "Simple full-body lifting with a short rowing finisher.",
      structure: [["Goblet Squat", 3, "10"], ["Push-up", 3, "AMRAP"], ["Seated Cable Row", 3, "10"], { exercise: "Rowing Machine", duration: 8, notes: "Easy-hard finish, log meters." }],
    },
    {
      author: "coach_dan", title: "Dan's 40-min Lunch Break Full Body", kind: "strength", difficulty: 2, est: 40,
      description: "For my clients who 'don't have time'. Superset everything, leave strong.",
      structure: [["Goblet Squat", 3, "10"], ["Push-up", 3, "AMRAP"], ["Seated Cable Row", 3, "10"], ["Romanian Deadlift", 3, "10"], ["Farmer's Carry", 3, "40m"]],
      completed: 23, saves: 11,
    },
    {
      author: "coach_dan", title: "Glute Hypertrophy Day", kind: "strength", difficulty: 3, est: 55,
      description: "Hip thrust focus, quads and hamstrings supporting cast.",
      structure: [["Hip Thrust", 4, "8-10"], ["Barbell Back Squat", 3, "8"], ["Romanian Deadlift", 3, "10"], ["Dumbbell Lunge", 3, "12"], ["Leg Curl", 3, "12-15"]],
      completed: 9, saves: 6,
    },
  ];
  const workoutIdByTitle = new Map<string, string>();
  const defs = authorIdFor ? WORKOUTS : WORKOUTS.filter((w) => w.author == null);
  for (const w of defs) {
    const [row] = await db
      .insert(workouts)
      .values({
        authorId: w.author ? authorIdFor!(w.author) : null,
        title: w.title, description: w.description, kind: w.kind,
        difficulty: w.difficulty, estDurationMin: w.est, isTemplate: w.author == null,
        structure: w.structure.map((item) => {
          if (Array.isArray(item)) {
            const [name, sets, reps] = item;
            return { exerciseId: ex(name), kind: "strength", activityType: "strength", sets, reps };
          }
          const row = exByName.get(item.exercise);
          if (!row) throw new Error(`Seed exercise missing: ${item.exercise}`);
          return {
            exerciseId: row.id,
            kind: row.activityType === "mobility" ? "mobility" : "cardio",
            activityType: row.activityType,
            sets: item.sets,
            reps: item.reps,
            targetDurationMin: item.duration,
            targetDistanceM: item.distanceM,
            notes: item.notes,
          };
        }) as schema.WorkoutStructure,
        completedCount: w.completed ?? 0, saveCount: w.saves ?? 0,
      })
      .returning();
    workoutIdByTitle.set(w.title, row.id);
  }
  console.log(`  ${defs.length} workouts (${defs.filter((w) => !w.author).length} templates)`);
  return workoutIdByTitle;
}

async function ensureCardioWorkoutTemplates(exByName: Awaited<ReturnType<typeof seedExercises>>) {
  const existingTitles = new Set((await db.select({ title: workouts.title }).from(workouts)).map((w) => w.title));
  const ex = (name: string) => {
    const row = exByName.get(name);
    if (!row) throw new Error(`Seed exercise missing: ${name}`);
    return row;
  };
  const templates = [
    {
      title: "Beginner 5K Run/Walk",
      description: "Easy intervals toward a 5K: run what you can, walk before form falls apart.",
      kind: "cardio",
      difficulty: 1,
      estDurationMin: 35,
      structure: [{ name: "Outdoor Run", duration: 35, distanceM: 5000, notes: "Alternate easy running and brisk walking." }],
    },
    {
      title: "Treadmill Intervals",
      description: "Warm up, alternate controlled pushes with easy recovery, cool down.",
      kind: "cardio",
      difficulty: 2,
      estDurationMin: 30,
      structure: [{ name: "Treadmill Run", duration: 30, notes: "10 min easy, 8 x 1 min fast / 1 min easy, cool down." }],
    },
    {
      title: "2K Row Benchmark",
      description: "Classic rowing benchmark. Log meters and time; MacroVerse tracks 2K and split PRs.",
      kind: "cardio",
      difficulty: 3,
      estDurationMin: 12,
      structure: [{ name: "Rowing Machine", duration: 10, distanceM: 2000, notes: "Record total time and average stroke rate." }],
    },
    {
      title: "Zone 2 Bike",
      description: "Steady aerobic ride. Keep effort conversational.",
      kind: "cardio",
      difficulty: 1,
      estDurationMin: 45,
      structure: [{ name: "Stationary Bike", duration: 45, notes: "RPE 4-6, smooth cadence." }],
    },
    {
      title: "Full Body Strength + Cardio Finisher",
      description: "Simple full-body lifting with a short rowing finisher.",
      kind: "mixed",
      difficulty: 2,
      estDurationMin: 55,
      structure: [
        { name: "Goblet Squat", sets: 3, reps: "10" },
        { name: "Push-up", sets: 3, reps: "AMRAP" },
        { name: "Seated Cable Row", sets: 3, reps: "10" },
        { name: "Rowing Machine", duration: 8, notes: "Easy-hard finish, log meters." },
      ],
    },
  ];
  let inserted = 0;
  for (const t of templates) {
    if (existingTitles.has(t.title)) continue;
    await db.insert(workouts).values({
      authorId: null,
      title: t.title,
      description: t.description,
      kind: t.kind,
      difficulty: t.difficulty,
      estDurationMin: t.estDurationMin,
      isTemplate: true,
      structure: t.structure.map((item) => {
        const row = ex(item.name);
        return {
          exerciseId: row.id,
          kind: row.activityType === "strength" ? "strength" : row.activityType === "mobility" ? "mobility" : "cardio",
          activityType: row.activityType,
          sets: "sets" in item ? item.sets : undefined,
          reps: "reps" in item ? item.reps : undefined,
          targetDurationMin: "duration" in item ? item.duration : undefined,
          targetDistanceM: "distanceM" in item ? item.distanceM : undefined,
          notes: item.notes,
        };
      }) as schema.WorkoutStructure,
    });
    inserted++;
  }
  console.log(`  workout templates: cardio templates ready (${inserted} inserted)`);
}

async function main() {
  // Production bootstrap: reference data only, insert-only — never touches existing rows
  // (chains/exercises cascade-delete into user go-to orders and PRs, so no wipe here).
  if (referenceOnly) {
    console.log(`Seeding reference data (${DATABASE_URL ? "hosted Postgres" : "local PGlite"})…`);
    if (await db.$count(foods)) console.log("  foods: table not empty, skipped");
    else await seedFoods();
    if (await db.$count(chains)) console.log("  chains: table not empty, skipped");
    else await seedChainsAndMenus();
    const exByName = (await db.$count(exercises)) ? await ensureWorkoutActivities() : await seedExercises();
    if (await db.$count(workouts)) await ensureCardioWorkoutTemplates(exByName);
    else await seedWorkouts(exByName, null);
    console.log("Done (reference data only — no demo accounts created).");
    return;
  }

  console.log("Seeding…");

  // wipe (dev convenience — order matters for FKs)
  for (const t of [
    "content_warnings", "moderation_actions", "reports",
    "challenge_participants", "challenges", "group_members", "groups",
    "media_attachments", "photos",
    "personal_records", "workout_logs", "workouts", "exercises",
    "meal_prep_items", "meal_prep_plans", "grocery_items", "grocery_lists",
    "habit_logs", "habits", "progress_entries", "go_to_orders",
    "menu_item_options", "menu_item_option_groups",
    "food_logs", "water_logs", "recipe_reviews", "recipe_ingredients", "comments",
    "reactions", "votes", "saves", "posts", "follows", "nutrition_targets",
    "recipes", "personal_ingredients", "foods",
    "menu_items", "restaurants", "chains",
    "feedback", "nutrition_import_batches",
    "sessions", "profiles", "users",
  ]) {
    await db.execute(sql.raw(`DELETE FROM ${t}`));
  }

  // foods
  const foodByName = await seedFoods();

  // users
  const hash = await bcrypt.hash("password123", 10);
  const defs = [
    { email: "maria@macromap.app", username: "chef_maria", displayName: "Maria Delgado", bio: "High-protein recipes that don't taste like a chore. 400+ meal preps and counting.", goal: "recomp", reputation: 480 },
    { email: "prepking@macromap.app", username: "prep_king", displayName: "Marcus (Prep King)", bio: "I cook once and eat all week. Budget meal prep, big batches, zero sad desk lunches.", goal: "muscle_gain", reputation: 350 },
    { email: "dan@macromap.app", username: "coach_dan", displayName: "Coach Dan", bio: "Strength coach. Protein evangelist. Your squat is high.", goal: "performance", reputation: 290 },
    { email: "demo@macromap.app", username: "demo", displayName: "Demo User", bio: "Just here trying to hit my macros.", goal: "fat_loss", reputation: 10 },
    { email: "admin@macromap.app", username: "macroverse_admin", displayName: "MacroVerse Admin", bio: "Keeping the nutrition data honest.", goal: "maintenance", reputation: 100, role: "admin" },
  ];
  const userByUsername = new Map<string, string>();
  for (const d of defs) {
    const [u] = await db.insert(users).values({ email: d.email, passwordHash: hash, reputation: d.reputation, role: (d as { role?: string }).role ?? "user" }).returning();
    await db.insert(profiles).values({
      userId: u.id, username: d.username, displayName: d.displayName, bio: d.bio,
      goal: d.goal, trackingStyle: "strict_macro", activityLevel: "moderate",
      sex: "male", heightCm: 178, weightKg: 80, birthYear: 1996, onboardedAt: new Date(),
    });
    await db.insert(nutritionTargets).values({
      userId: u.id,
      calories: d.goal === "fat_loss" ? 2100 : 2700,
      proteinG: 170, carbsG: d.goal === "fat_loss" ? 190 : 300, fatG: d.goal === "fat_loss" ? 60 : 80,
    });
    userByUsername.set(d.username, u.id);
  }
  console.log(`  ${defs.length} users`);

  // follows: demo follows everyone; creators follow each other
  const pairs: [string, string][] = [
    ["demo", "chef_maria"], ["demo", "prep_king"], ["demo", "coach_dan"],
    ["chef_maria", "prep_king"], ["prep_king", "chef_maria"], ["coach_dan", "chef_maria"],
    ["chef_maria", "coach_dan"],
  ];
  await db.insert(follows).values(
    pairs.map(([a, b]) => ({ followerId: userByUsername.get(a)!, followeeId: userByUsername.get(b)! })),
  );

  // recipes with ingredient-calculated macros
  const recipeIds: { id: string; author: string; name: string }[] = [];
  for (const r of RECIPES) {
    const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, saturatedFatG: 0, sodiumMg: 0 };
    for (const [name, grams] of r.ingredients) {
      const f = foodByName.get(name);
      if (!f) throw new Error(`Seed food missing: ${name}`);
      const k = grams / 100;
      totals.calories += f.calories * k;
      totals.proteinG += f.proteinG * k;
      totals.carbsG += f.carbsG * k;
      totals.fatG += f.fatG * k;
      totals.fiberG += (f.fiberG ?? 0) * k;
      totals.sugarG += (f.sugarG ?? 0) * k;
      totals.saturatedFatG += (f.saturatedFatG ?? 0) * k;
      totals.sodiumMg += (f.sodiumMg ?? 0) * k;
    }
    const per = (n: number) => Math.round((n / r.servings) * 10) / 10;
    const [rec] = await db
      .insert(recipes)
      .values({
        authorId: userByUsername.get(r.author)!,
        name: r.name, description: r.description, instructions: r.instructions,
        servings: r.servings, servingDesc: r.servingDesc,
        calories: per(totals.calories), proteinG: per(totals.proteinG),
        carbsG: per(totals.carbsG), fatG: per(totals.fatG),
        fiberG: per(totals.fiberG), sugarG: per(totals.sugarG),
        saturatedFatG: per(totals.saturatedFatG), sodiumMg: per(totals.sodiumMg),
        macroSource: "ingredient_calculated", macroConfidence: 0.8,
        prepMin: r.prepMin, cookMin: r.cookMin, difficulty: r.difficulty,
        costCents: r.costCents, tags: r.tags,
      })
      .returning();
    await db.insert(recipeIngredients).values(
      r.ingredients.map(([name, grams], i) => ({
        recipeId: rec.id, foodId: foodByName.get(name)!.id,
        rawText: `${grams}g ${name}`, grams, position: i,
      })),
    );
    recipeIds.push({ id: rec.id, author: r.author, name: r.name });
  }
  console.log(`  ${recipeIds.length} recipes`);

  // votes, saves, tried/reviews — everyone interacts with others' recipes
  const allUsernames = defs.map((d) => d.username);
  const reviewBodies = [
    "Made this twice already. Macros checked out on my scale.",
    "Solid. Doubled the seasoning like Maria says and it slaps.",
    "Survived 4 days in the fridge no problem.",
    "My whole gym group meal preps this now.",
  ];
  let interactions = 0;
  for (const rec of recipeIds) {
    for (const uname of allUsernames) {
      if (uname === rec.author) continue;
      const uid = userByUsername.get(uname)!;
      const roll = (uname.length + rec.name.length) % 4; // deterministic variety
      if (roll < 3) {
        await db.insert(votes).values({ userId: uid, subjectType: "recipe", subjectId: rec.id, value: 1 });
        await db.update(recipes).set({ upvotes: sql`${recipes.upvotes} + 1` }).where(sql`id = ${rec.id}`);
        interactions++;
      }
      if (roll % 2 === 0) {
        await db.insert(saves).values({ userId: uid, subjectType: "recipe", subjectId: rec.id });
        await db.update(recipes).set({ saveCount: sql`${recipes.saveCount} + 1` }).where(sql`id = ${rec.id}`);
        interactions++;
      }
      if (roll === 0) {
        const rating = 4 + ((uname.length + rec.name.length) % 2);
        await db.insert(recipeReviews).values({
          recipeId: rec.id, userId: uid, rating,
          body: reviewBodies[(uname.length + rec.name.length) % reviewBodies.length],
        });
        await db
          .update(recipes)
          .set({
            triedCount: sql`${recipes.triedCount} + 1`,
            ratingSum: sql`${recipes.ratingSum} + ${rating}`,
            ratingCount: sql`${recipes.ratingCount} + 1`,
          })
          .where(sql`id = ${rec.id}`);
        interactions++;
      }
    }
  }
  console.log(`  ${interactions} recipe interactions`);

  // posts: text posts + recipe shares
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
  let t = 60;
  for (const p of POSTS) {
    const [post] = await db
      .insert(posts)
      .values({ authorId: userByUsername.get(p.author)!, type: p.type, body: p.body, createdAt: hoursAgo(t) })
      .returning();
    t -= 9;
    // sprinkle reactions from the others
    for (const uname of allUsernames) {
      if (uname === p.author) continue;
      if ((uname.length + p.body.length) % 3 === 0) continue;
      const kinds = ["like", "strong", "macro_win", "pr", "high_protein"];
      await db.insert(reactions).values({
        userId: userByUsername.get(uname)!, subjectType: "post", subjectId: post.id,
        kind: kinds[(uname.length + p.body.length) % kinds.length],
      });
      await db.update(posts).set({ reactionCount: sql`${posts.reactionCount} + 1` }).where(sql`id = ${post.id}`);
    }
  }
  const shares: [string, string, string][] = [
    ["chef_maria", "Meal Prep Chicken Burrito Bowls", "New recipe up — my most-requested prep, finally written down properly. 5 bowls, 44g protein each."],
    ["prep_king", "Turkey Chili (Big Batch)", "The freezer chili. $2.10 a serving, 8 servings, macros in the card. You're welcome."],
    ["coach_dan", "Greek Yogurt Protein Bowl", "For everyone who says they 'don't have time' — this is 45g of protein in 4 minutes with zero cooking."],
  ];
  for (const [author, recipeName, body] of shares) {
    const rec = recipeIds.find((r) => r.name === recipeName)!;
    const [post] = await db
      .insert(posts)
      .values({
        authorId: userByUsername.get(author)!, type: "recipe", body,
        refType: "recipe", refId: rec.id, createdAt: hoursAgo(t),
      })
      .returning();
    t -= 7;
    await db.insert(comments).values({
      authorId: userByUsername.get(author === "coach_dan" ? "chef_maria" : "coach_dan")!,
      subjectType: "post", subjectId: post.id, body: "Adding this to next week's rotation 🔥",
    });
    await db.update(posts).set({ commentCount: 1 }).where(sql`id = ${post.id}`);
  }
  console.log(`  ${POSTS.length + shares.length} posts`);

  // demo user's diary: yesterday full, today partial (uses recipes → logCount)
  const demoId = userByUsername.get("demo")!;
  const day = (offset: number) => {
    const d = new Date(Date.now() + offset * 86400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const logRecipeFor = async (dateStr: string, slot: string, recipeName: string, servings = 1) => {
    const rec = recipeIds.find((r) => r.name === recipeName)!;
    const [full] = await db.select().from(recipes).where(sql`id = ${rec.id}`);
    await db.insert(foodLogs).values({
      userId: demoId, logDate: dateStr, mealSlot: slot, recipeId: rec.id, name: full.name,
      servings,
      calories: full.calories * servings, proteinG: full.proteinG * servings,
      carbsG: full.carbsG * servings, fatG: full.fatG * servings,
      fiberG: full.fiberG != null ? full.fiberG * servings : null,
      sugarG: full.sugarG != null ? full.sugarG * servings : null,
      saturatedFatG: full.saturatedFatG != null ? full.saturatedFatG * servings : null,
      sodiumMg: full.sodiumMg != null ? full.sodiumMg * servings : null,
    });
    await db.update(recipes).set({ logCount: sql`${recipes.logCount} + 1` }).where(sql`id = ${rec.id}`);
  };
  const logFoodFor = async (dateStr: string, slot: string, foodName: string, servings: number) => {
    const f = foodByName.get(foodName)!;
    await db.insert(foodLogs).values({
      userId: demoId, logDate: dateStr, mealSlot: slot, foodId: f.id, name: f.name, servings,
      calories: f.calories * servings, proteinG: f.proteinG * servings,
      carbsG: f.carbsG * servings, fatG: f.fatG * servings,
      fiberG: f.fiberG != null ? f.fiberG * servings : null,
      sugarG: f.sugarG != null ? f.sugarG * servings : null,
      saturatedFatG: f.saturatedFatG != null ? f.saturatedFatG * servings : null,
      sodiumMg: f.sodiumMg != null ? f.sodiumMg * servings : null,
    });
  };
  for (const offset of [-3, -2, -1]) {
    await logRecipeFor(day(offset), "breakfast", "Protein Overnight Oats");
    await logRecipeFor(day(offset), "lunch", "Meal Prep Chicken Burrito Bowls");
    await logRecipeFor(day(offset), "dinner", offset === -1 ? "Air Fryer Salmon & Sweet Potato" : "Turkey Chili (Big Batch)");
    await logFoodFor(day(offset), "snack", "Greek yogurt, nonfat", 1.7);
    await db.insert(waterLogs).values({ userId: demoId, logDate: day(offset), ml: 2250 });
  }
  await logRecipeFor(day(0), "breakfast", "10-Minute Egg White Scramble Wrap");
  await logFoodFor(day(0), "snack", "Apple", 1.8);
  await db.insert(waterLogs).values({ userId: demoId, logDate: day(0), ml: 750 });
  console.log("  demo diary (3 past days + today)");

  // ─── restaurants: chains, locations (downtown Austin demo area), menus ──────
  const { chainIdByName, buildableByChain } = await seedChainsAndMenus();

  // community go-to orders → "popular builds" on chain pages
  const seedOrder = async (
    username: string, chainName: string, orderName: string, optionNames: string[], logCount: number,
  ) => {
    const b = buildableByChain.get(chainName)!;
    const optionIds = optionNames.map((n) => {
      const id = b.optionIdByName.get(n);
      if (!id) throw new Error(`Seed option missing: ${chainName} / ${n}`);
      return id;
    });
    const opts = await db.select().from(menuItemOptions).where(inArray(menuItemOptions.id, optionIds));
    const byId = new Map(opts.map((o) => [o.id, o]));
    const sum = (k: "calories" | "proteinG" | "carbsG" | "fatG") =>
      optionIds.reduce((a, id) => a + Number(byId.get(id)![k]), 0);
    await db.insert(goToOrders).values({
      userId: userByUsername.get(username)!, chainId: chainIdByName.get(chainName)!,
      name: orderName, items: [{ menuItemId: b.itemId, optionIds }],
      calories: sum("calories"), proteinG: sum("proteinG"), carbsG: sum("carbsG"), fatG: sum("fatG"),
      logCount,
    });
  };
  await seedOrder("coach_dan", "Chipotle", "Double chicken cutting bowl",
    ["Supergreens lettuce", "Chicken", "Chicken", "Black beans", "Fajita veggies", "Fresh tomato salsa"], 14);
  await seedOrder("prep_king", "Chipotle", "The bulk bowl",
    ["White rice", "White rice", "Steak", "Steak", "Black beans", "Cheese", "Fresh tomato salsa"], 9);
  await seedOrder("chef_maria", "Subway", "Turkey double-meat, no mayo",
    ["9-Grain wheat", "Turkey breast", "Turkey breast", "Lettuce", "Tomatoes", "Red onions", "Yellow mustard"], 7);
  await seedOrder("coach_dan", "Sweetgreen", "Post-lift greens",
    ["Chopped romaine", "Roasted chicken", "Roasted chicken", "Chickpeas", "Tomatoes", "Lime cilantro jalapeño vinaigrette"], 5);
  console.log("  4 go-to orders");

  // ─── demo progress: 6 weeks of weigh-ins trending down + default habits ──────
  const demoUserId = userByUsername.get("demo")!;
  const weights = [84.2, 83.8, 83.5, 82.9, 82.6, 82.1, 81.9];
  await db.insert(progressEntries).values(
    weights.map((w, i) => ({
      userId: demoUserId,
      entryDate: day(-(weights.length - 1 - i) * 7),
      weightKg: w,
      waistCm: i % 2 === 0 ? 92 - i * 0.5 : null,
      note: i === weights.length - 1 ? "Cut is working — keeping protein high." : null,
    })),
  );
  const habitDefs = [
    { name: "Hit protein goal", emoji: "🍗" },
    { name: "Drink 2L water", emoji: "💧" },
    { name: "Move today", emoji: "🏃" },
    { name: "Eat veggies", emoji: "🥦" },
  ];
  for (const h of habitDefs) {
    const [habit] = await db.insert(habits).values({ userId: demoUserId, ...h, isDefault: true }).returning();
    // protein + water done the last 3 days; move done 2 of 3 — streaks render
    const days = h.name === "Move today" ? [-2, -1] : h.name === "Eat veggies" ? [-1] : [-3, -2, -1];
    if (days.length) await db.insert(habitLogs).values(days.map((o) => ({ habitId: habit.id, logDate: day(o) })));
  }
  console.log(`  ${weights.length} progress entries, ${habitDefs.length} habits`);

  // ─── exercises library + workouts (templates + community) ──────────────────
  const exByName = await seedExercises();
  const ex = (name: string) => {
    const row = exByName.get(name);
    if (!row) throw new Error(`Seed exercise missing: ${name}`);
    return row.id;
  };

  const workoutIdByTitle = await seedWorkouts(exByName, (u) => userByUsername.get(u)!);

  // demo's training history + the PRs it produced (Epley e1rm, capped at 12 reps)
  const e1rm = (w: number, r: number) => Math.round(w * (1 + Math.min(r, 12) / 30) * 10) / 10;
  const sessions: { daysAgo: number; sets: [exercise: string, weightKg: number, reps: number][] }[] = [
    { daysAgo: 6, sets: [["Barbell Back Squat", 100, 5], ["Barbell Bench Press", 75, 5], ["Barbell Row", 65, 8]] },
    { daysAgo: 4, sets: [["Deadlift", 130, 5], ["Overhead Press", 45, 5], ["Lat Pulldown", 55, 10]] },
    { daysAgo: 1, sets: [["Barbell Back Squat", 105, 5], ["Barbell Bench Press", 77.5, 4], ["Barbell Row", 67.5, 8]] },
  ];
  for (const s of sessions) {
    const entriesByEx = new Map<string, { reps: number; weightKg: number }[]>();
    for (const [name, weightKg, reps] of s.sets) {
      const id = ex(name);
      entriesByEx.set(id, [...(entriesByEx.get(id) ?? []), { reps, weightKg }, { reps, weightKg }, { reps: Math.max(1, reps - 1), weightKg }]);
    }
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId: demoUserId,
        workoutId: workoutIdByTitle.get("Full Body Starter A"),
        performedAt: new Date(Date.now() - s.daysAgo * 86400_000),
        durationMin: 48,
        entries: [...entriesByEx.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets })),
      })
      .returning();
    // PRs: keep the best e1rm/volume seen so far per exercise
    for (const [exerciseId, sets] of entriesByEx) {
      const bestE = Math.max(...sets.map((st) => e1rm(st.weightKg, st.reps)));
      const vol = sets.reduce((a, st) => a + st.weightKg * st.reps, 0);
      for (const [metric, value] of [["e1rm", bestE], ["volume", vol]] as const) {
        const [existing] = await db
          .select()
          .from(personalRecords)
          .where(sql`user_id = ${demoUserId} AND exercise_id = ${exerciseId} AND metric = ${metric}`);
        if (!existing) {
          await db.insert(personalRecords).values({ userId: demoUserId, exerciseId, metric, value, workoutLogId: log.id, achievedAt: log.performedAt });
        } else if (value > existing.value) {
          await db.update(personalRecords).set({ value, workoutLogId: log.id, achievedAt: log.performedAt }).where(sql`id = ${existing.id}`);
        }
      }
    }
  }
  console.log(`  ${sessions.length} demo workout sessions + PRs`);

  // ─── meal prep plans composed from seeded recipes ───────────────────────────
  const PLANS: { author: string; title: string; description: string; days: number; storage: string; items: [recipeName: string, servings: number][]; ups: number; savesN: number }[] = [
    {
      author: "prep_king", title: "The $40 Cutting Week", days: 5,
      description: "Five lunches, five dinners, two breakfasts on repeat. Boring? Maybe. 150g protein a day under 2100 kcal? Absolutely.",
      storage: "Everything keeps 4 days in the fridge; freeze Friday's chili portion.",
      items: [["Meal Prep Chicken Burrito Bowls", 5], ["Turkey Chili (Big Batch)", 5], ["Protein Overnight Oats", 5]],
      ups: 14, savesN: 9,
    },
    {
      author: "chef_maria", title: "Lean Bulk Foundation Week", days: 5,
      description: "Surplus without the seed oils. Beef bowls for size, salmon for sanity.",
      storage: "Beef bowls fridge 4 days. Cook salmon fresh — 12 minutes, worth it.",
      items: [["Beef & Rice Power Bowls", 8], ["Air Fryer Salmon & Sweet Potato", 4], ["Post-Workout Protein Pancakes", 3]],
      ups: 8, savesN: 5,
    },
  ];
  for (const p of PLANS) {
    const memberRows = p.items.map(([name, servings], i) => {
      const rec = recipeIds.find((r) => r.name === name);
      if (!rec) throw new Error(`Seed plan recipe missing: ${name}`);
      return { recipeId: rec.id, servings, position: i };
    });
    const fullRecipes = await db.select().from(recipes).where(inArray(recipes.id, memberRows.map((m) => m.recipeId)));
    const byId = new Map(fullRecipes.map((r) => [r.id, r]));
    const totalServings = memberRows.reduce((a, m) => a + m.servings, 0);
    const tot = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, cost: 0 };
    for (const m of memberRows) {
      const r = byId.get(m.recipeId)!;
      tot.calories += r.calories * m.servings;
      tot.proteinG += r.proteinG * m.servings;
      tot.carbsG += r.carbsG * m.servings;
      tot.fatG += r.fatG * m.servings;
      tot.cost += (r.costCents ?? 0) * m.servings;
    }
    const per = (n: number) => Math.round((n / totalServings) * 10) / 10;
    const [plan] = await db
      .insert(mealPrepPlans)
      .values({
        authorId: userByUsername.get(p.author)!,
        title: p.title, description: p.description, daysCovered: p.days,
        totalServings: Math.round(totalServings), storageNotes: p.storage,
        calories: per(tot.calories), proteinG: per(tot.proteinG), carbsG: per(tot.carbsG), fatG: per(tot.fatG),
        costPerServingCents: Math.round(tot.cost / totalServings),
        upvotes: p.ups, saveCount: p.savesN,
      })
      .returning();
    await db.insert(mealPrepItems).values(memberRows.map((m) => ({ planId: plan.id, ...m })));
  }
  console.log(`  ${PLANS.length} meal prep plans`);

  // ─── groups, challenges, sample reports (Phase 6) ───────────────────────────
  

  const GROUPS: { name: string; slug: string; kind: string; description: string; owner: string; members: string[]; posts: [author: string, body: string][] }[] = [
    {
      name: "Cutting Crew", slug: "cutting-crew", kind: "goal", owner: "coach_dan",
      description: "Deficit season, together. Protein high, patience higher.",
      members: ["chef_maria", "demo"],
      posts: [
        ["coach_dan", "Weekly check-in thread 🧵 — drop your adherence % and one win from this week. Mine: 6/7 days on target, finally stopped snacking after dinner."],
        ["demo", "First week in the group — 4/7 days on target. The burrito bowl prep is carrying me honestly."],
        ["chef_maria", "Cutting tip: volume vegetables are free real estate. Half the plate, every plate."],
      ],
    },
    {
      name: "Meal Prep Sunday", slug: "meal-prep-sunday", kind: "interest", owner: "prep_king",
      description: "One day of cooking, a week of not thinking about it. Show us your containers.",
      members: ["chef_maria", "coach_dan"],
      posts: [
        ["prep_king", "This week's spread: turkey chili ×8, burrito bowls ×5, overnight oats ×5. 90 minutes total. Ask me anything."],
        ["chef_maria", "Container recommendation thread — glass or the good plastic ones that don't stain? Wrong answers only."],
      ],
    },
    {
      name: "ATX Lifters", slug: "atx-lifters", kind: "location", owner: "coach_dan",
      description: "Austin-area lifters. Gym meetups, PR celebrations, taco macro debates.",
      members: ["demo"],
      posts: [["coach_dan", "Saturday 9am squat session at Big Tex Gym — first-timers welcome, we'll sort your form out."]],
    },
  ];
  const groupIdBySlug = new Map<string, string>();
  for (const g of GROUPS) {
    const memberCount = g.members.length + 1;
    const [group] = await db
      .insert(groups)
      .values({ name: g.name, slug: g.slug, kind: g.kind, description: g.description, createdBy: userByUsername.get(g.owner)!, memberCount })
      .returning();
    groupIdBySlug.set(g.slug, group.id);
    await db.insert(groupMembers).values([
      { groupId: group.id, userId: userByUsername.get(g.owner)!, role: "owner" },
      ...g.members.map((m) => ({ groupId: group.id, userId: userByUsername.get(m)! })),
    ]);
    let gt = 30;
    for (const [author, body] of g.posts) {
      await db.insert(posts).values({ authorId: userByUsername.get(author)!, type: "general", body, groupId: group.id, createdAt: hoursAgo(gt) });
      gt -= 8;
    }
  }
  console.log(`  ${GROUPS.length} groups with posts`);

  const CHALLENGES: { title: string; description: string; metric: string; target: number; unit: string; startsOn: string; endsOn: string; group?: string; creator: string; participants: string[] }[] = [
    {
      title: "28-Day Protein Streak", description: "Hit your protein target (within 5%) on 20 of the next 28 days. Auto-scored from your diary.",
      metric: "protein_days", target: 20, unit: "days", startsOn: day(-7), endsOn: day(21),
      creator: "coach_dan", participants: ["demo", "chef_maria", "prep_king"],
    },
    {
      title: "Log Everything Week", description: "7 straight days with every meal logged. The habit that makes every other habit measurable.",
      metric: "logged_days", target: 7, unit: "days", startsOn: day(-3), endsOn: day(4),
      group: "cutting-crew", creator: "coach_dan", participants: ["demo", "chef_maria"],
    },
    {
      title: "12 Workouts in 30 Days", description: "Three a week, roughly. Any session logged counts.",
      metric: "workouts", target: 12, unit: "sessions", startsOn: day(-10), endsOn: day(20),
      creator: "prep_king", participants: ["demo", "coach_dan"],
    },
  ];
  for (const c of CHALLENGES) {
    const [challenge] = await db
      .insert(challenges)
      .values({
        title: c.title, description: c.description, metric: c.metric, target: c.target, unit: c.unit,
        startsOn: c.startsOn, endsOn: c.endsOn,
        groupId: c.group ? groupIdBySlug.get(c.group)! : null,
        createdBy: userByUsername.get(c.creator)!,
      })
      .returning();
    await db.insert(challengeParticipants).values(
      [c.creator, ...c.participants].map((u) => ({ challengeId: challenge.id, userId: userByUsername.get(u)! })),
    );
  }
  console.log(`  ${CHALLENGES.length} challenges`);

  // a couple of open reports so the admin queue demonstrates the pipeline
  const spamPost = await db
    .insert(posts)
    .values({
      authorId: userByUsername.get("prep_king")!, type: "general",
      body: "🔥🔥 MELT FAT FAST with my new SUPPLEMENT STACK — DM me for the discount code!! Not medical advice 😉",
      createdAt: hoursAgo(3),
    })
    .returning();
  await db.insert(reports).values([
    { reporterId: userByUsername.get("chef_maria")!, subjectType: "post", subjectId: spamPost[0].id, reason: "spam", detail: "Supplement affiliate spam, out of character for this account — possibly compromised?" },
    { reporterId: userByUsername.get("demo")!, subjectType: "recipe", subjectId: recipeIds[0].id, reason: "inaccurate_macros", detail: "Weighed my batch and got ~15% more calories per bowl than listed." },
  ]);
  console.log("  2 open reports");

  console.log("Done. Sign in as demo@macromap.app / password123 (admin@macromap.app for /admin/reports + /admin/imports)");
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => {});
    process.exit(1);
  });
