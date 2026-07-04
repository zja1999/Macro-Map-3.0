import { defineConfig } from "drizzle-kit";

// Local dev runs on PGlite (embedded Postgres, zero setup).
// For a hosted Postgres, set DATABASE_URL and change driver handling in src/db/client.ts.
export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: "./.data/pglite" },
});
