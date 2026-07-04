import { mkdirSync } from "fs";
import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

mkdirSync("./.data", { recursive: true });

// Embedded Postgres persisted to ./.data/pglite — zero external services in dev.
// Swapping to hosted Postgres later: replace this driver with drizzle-orm/node-postgres
// reading DATABASE_URL; the schema and every query are already Postgres-native.

const globalForDb = globalThis as unknown as { pglite?: PGlite };

const client = globalForDb.pglite ?? new PGlite("./.data/pglite");
if (process.env.NODE_ENV !== "production") globalForDb.pglite = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
