import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the production auth-schema preflight.");
}

const pool = new pg.Pool({ connectionString });

try {
  const result = await pool.query(`
    select count(*)::int as duplicate_groups
    from (
      select user_id, provider
      from oauth_accounts
      group by user_id, provider
      having count(*) > 1
    ) duplicate_links
  `);

  const duplicateGroups = result.rows[0]?.duplicate_groups ?? 0;
  if (duplicateGroups > 0) {
    throw new Error(`Found ${duplicateGroups} duplicate OAuth user/provider group(s). Resolve them before applying the schema.`);
  }

  console.log("Auth schema preflight passed: no duplicate OAuth user/provider links.");
} finally {
  await pool.end();
}
