import * as schema from "./schema";

// Two drivers, one schema — every query is Postgres-native either way:
//  - DATABASE_URL set (production / staging): node-postgres pool against hosted Postgres
//    (Neon, Supabase, Railway, RDS…). See docs/operations.md.
//  - No DATABASE_URL (local dev): embedded PGlite persisted to ./.data/pglite, zero setup.

// Both drivers expose the same PgDatabase query API; typing as one keeps
// drizzle's overloads intact (a union collapses them).
type Db = ReturnType<typeof makePglite>;

// Next evaluates server modules in several short-lived worker processes while
// collecting route metadata. None of those workers should open the local
// single-process database: doing so leaves PGlite's WASM runtime mid-shutdown
// when the worker exits and produces misleading `RuntimeError: Aborted()` build
// warnings. Dynamic application routes create the real database at request time.
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

function makePg(url: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  return drizzle(url, { schema, casing: "snake_case" });
}

function makePglite() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require("fs") as typeof import("fs")).mkdirSync("./.data", { recursive: true });

  const globalForDb = globalThis as unknown as { pglite?: InstanceType<typeof PGlite> };
  const client = globalForDb.pglite ?? new PGlite("./.data/pglite");
  globalForDb.pglite = client; // survive dev HMR
  return drizzle(client, { schema, casing: "snake_case" });
}

const globalForDrizzle = globalThis as unknown as { drizzleDb?: Db };

const buildTimeDb = new Proxy({} as Db, {
  get() {
    throw new Error("Database access is not available during Next.js production-build analysis");
  },
});

export const db: Db =
  isNextProductionBuild
    ? buildTimeDb
    : globalForDrizzle.drizzleDb ??
      (process.env.DATABASE_URL ? (makePg(process.env.DATABASE_URL) as unknown as Db) : makePglite());

if (!isNextProductionBuild && process.env.NODE_ENV !== "production") globalForDrizzle.drizzleDb = db;
