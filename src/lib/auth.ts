import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { eq, gt, and, desc } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { sessions, users, profiles, nutritionTargets } from "@/db/schema";

const COOKIE = "mm_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
  reputation: number;
  isGuest: boolean;
  profile: typeof profiles.$inferSelect;
  targets: typeof nutritionTargets.$inferSelect | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, profile: profiles })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows[0]) return null;

  const { user, profile } = rows[0];
  const targets = await db
    .select()
    .from(nutritionTargets)
    .where(eq(nutritionTargets.userId, user.id))
    .orderBy(desc(nutritionTargets.createdAt))
    .limit(1);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    reputation: user.reputation,
    isGuest: user.isGuest,
    profile,
    targets: targets[0] ?? null,
  };
});
