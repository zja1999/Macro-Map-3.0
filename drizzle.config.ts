import { defineConfig } from "drizzle-kit";

// Local dev runs on PGlite (embedded Postgres, zero setup).
// With DATABASE_URL set, drizzle-kit targets the hosted Postgres instead —
// same schema file either way. See docs/AGENT-HANDOFF.md.
export default defineConfig(
  process.env.DATABASE_URL
    ? {
        dialect: "postgresql",
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        casing: "snake_case",
        dbCredentials: { url: process.env.DATABASE_URL },
      }
    : {
        dialect: "postgresql",
        driver: "pglite",
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        casing: "snake_case",
        dbCredentials: { url: "./.data/pglite" },
      },
);
