/* Per-user sliding-window rate limits (docs/07 §5) — Postgres counts over the
 * last 24h, no extra infrastructure. New accounts (<10 reputation) get half. */
import { createHash } from "crypto";
import { headers } from "next/headers";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, posts, rateLimitEvents, recipes, reports } from "@/db/schema";

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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestFingerprint(extra = "") {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = h.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown-ip";
  const ua = h.get("user-agent")?.slice(0, 200) || "unknown-agent";
  return sha256(`${ip}|${ua}|${extra}`);
}

export async function checkRequestRateLimit(input: {
  kind: string;
  identifier: string;
  limit: number;
  windowMs: number;
  label: string;
}): Promise<string | null> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - input.windowMs);
  const identifierHash = sha256(input.identifier);

  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(rateLimitEvents)
    .where(and(eq(rateLimitEvents.kind, input.kind), eq(rateLimitEvents.identifierHash, identifierHash), gte(rateLimitEvents.createdAt, cutoff)));

  if (Number(row.n) >= input.limit) return `Too many ${input.label}. Try again later.`;

  await db.transaction(async (tx) => {
    await tx.insert(rateLimitEvents).values({ kind: input.kind, identifierHash, createdAt: now });
    await tx.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, new Date(now.getTime() - 7 * 24 * 3600_000)));
  });
  return null;
}
