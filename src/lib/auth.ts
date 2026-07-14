import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  email: string | null;
  role: string;
  reputation: number;
  isGuest: boolean;
  profile: typeof profiles.$inferSelect;
  targets: typeof nutritionTargets.$inferSelect | null;
};

export type SessionUser = CurrentUser & {
  hasPassword: boolean;
  sessionTokenHash: string;
  reauthenticatedAt: Date | null;
};

export async function createAuthenticatedSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const now = new Date();
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt, reauthenticatedAt: now });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, profile: profiles, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows[0]) return null;

  const { user, profile, session } = rows[0];
  // banned = the session is dead: block every authenticated surface at the source
  if (user.bannedAt) return null;
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
    hasPassword: !!user.passwordHash,
    sessionTokenHash: session.tokenHash,
    reauthenticatedAt: session.reauthenticatedAt,
  };
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.hasPassword) return null;
  const { hasPassword: _hasPassword, sessionTokenHash: _sessionTokenHash, reauthenticatedAt: _reauthenticatedAt, ...user } = sessionUser;
  return user;
});

export function isRecentlyReauthenticated(value: Date | null, now = new Date()) {
  return !!value && now.getTime() - value.getTime() <= 10 * 60_000;
}

/** Page-level session guard. Layouts redirect too, but Next renders pages in
 *  parallel with layouts — pages must not assume the layout got there first. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
