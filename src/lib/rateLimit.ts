/* Per-user sliding-window rate limits (docs/07 §5) — Postgres counts over the
 * last 24h, no extra infrastructure. New accounts (<10 reputation) get half. */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, posts, recipes, reports } from "@/db/schema";

const LIMITS = {
  post: { table: posts, col: posts.authorId, at: posts.createdAt, perDay: 10, label: "posts" },
  comment: { table: comments, col: comments.authorId, at: comments.createdAt, perDay: 60, label: "comments" },
  report: { table: reports, col: reports.reporterId, at: reports.createdAt, perDay: 20, label: "reports" },
  recipe: { table: recipes, col: recipes.authorId, at: recipes.createdAt, perDay: 5, label: "recipe submissions" },
} as const;

export type RateLimitKind = keyof typeof LIMITS;

/** Returns an error message when over the window limit, null when clear. */
export async function checkRateLimit(
  userId: string,
  kind: RateLimitKind,
  reputation: number,
): Promise<string | null> {
  const limit = LIMITS[kind];
  const cap = reputation < 10 ? Math.max(1, Math.floor(limit.perDay / 2)) : limit.perDay;
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(limit.table)
    .where(and(eq(limit.col, userId), gte(limit.at, cutoff)));
  if (Number(row.n) >= cap) {
    return `Rate limit: ${cap} ${limit.label} per day${reputation < 10 ? " for new accounts" : ""}. Try again later.`;
  }
  return null;
}
