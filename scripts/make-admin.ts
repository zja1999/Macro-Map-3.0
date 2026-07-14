/* Promotes an existing user to admin.
 * Register the account through the app first, then:
 *   local dev:  npm run make-admin -- your_username
 *   hosted:     DATABASE_URL="postgres://…" npm run make-admin -- you@example.com */
import { mkdirSync } from "fs";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const identifier = process.argv[2]?.trim().toLowerCase();
if (!identifier) {
  console.error("Usage: npm run make-admin -- username-or-email");
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

async function main() {
  const url = process.env.DATABASE_URL;
  const { db, close } = url ? makePg(url) : makePglite();

  const [target] = identifier.includes("@")
    ? await db.select({ id: schema.users.id, label: schema.users.email }).from(schema.users).where(eq(schema.users.email, identifier)).limit(1)
    : await db.select({ id: schema.profiles.userId, label: schema.profiles.username }).from(schema.profiles).where(eq(schema.profiles.username, identifier)).limit(1);
  if (!target) {
    console.error(`No user matching ${identifier}; register the account in the app first.`);
    await close();
    process.exit(1);
  }

  const updated = await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.id, target.id))
    .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role });

  if (updated.length === 0) {
    console.error(`Unable to promote ${identifier}.`);
    await close();
    process.exit(1);
  }
  console.log(`${target.label ?? identifier} is now ${updated[0].role} (user ${updated[0].id})`);
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
