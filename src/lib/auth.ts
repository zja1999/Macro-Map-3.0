import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import { eq, gt, and, desc, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { sessions, users, profiles, nutritionTargets, emailVerificationTokens } from "@/db/schema";
import { getAppUrl, sendVerificationEmail } from "@/lib/email";

const COOKIE = "mm_session";
const SESSION_DAYS = 30;
const EMAIL_VERIFICATION_MINUTES = 30;

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

export async function sendEmailVerification(userId: string, email: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(emailVerificationTokens).values({
    tokenHash: sha256(token),
    userId,
    email,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_MINUTES * 60_000),
  });
  await sendVerificationEmail({
    to: email,
    verifyUrl: `${getAppUrl()}/verify-email?token=${token}`,
  });
}

export async function verifyEmailToken(token: string): Promise<"ok" | "invalid"> {
  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, sha256(token)),
        gt(emailVerificationTokens.expiresAt, new Date()),
        isNull(emailVerificationTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row) return "invalid";

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, row.userId));
    await tx.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.tokenHash, row.tokenHash));
  });
  await createSession(row.userId);
  return "ok";
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
  };
});

/** Page-level session guard. Layouts redirect too, but Next renders pages in
 *  parallel with layouts — pages must not assume the layout got there first. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
