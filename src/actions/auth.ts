"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { oauthAccounts, passwordResetTokens, profiles, sessions, users } from "@/db/schema";
import {
  createAuthenticatedSession,
  destroySession,
  getSessionUser,
  isRecentlyReauthenticated,
} from "@/lib/auth";
import { tokenHash } from "@/lib/authTokens";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";
import { createWelcomeNotification } from "@/lib/welcomeNotification";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { consumePostAuthNext } from "@/lib/postAuthNext";
import {
  DUMMY_BCRYPT_HASH,
  normalizeUsername,
  passwordValidationError,
  usernameValidationError,
} from "@/lib/passwords";

type AuthState = { error?: string; ok?: string } | undefined;

const registerSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  username: z.string(),
  password: z.string(),
  passwordConfirmation: z.string(),
});

export async function register(_prev: AuthState, formData: FormData): Promise<NonNullable<AuthState>> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const username = normalizeUsername(parsed.data.username);
  const usernameError = usernameValidationError(username);
  if (usernameError) return { error: usernameError };
  const passwordError = passwordValidationError(parsed.data.password, parsed.data.passwordConfirmation);
  if (passwordError) return { error: passwordError };

  const limitError = await checkRequestRateLimit({
    kind: "register",
    identifier: await requestFingerprint(),
    limit: 5,
    windowMs: 60 * 60_000,
    label: "account creation attempts",
  });
  if (limitError) return { error: limitError };

  const [nameTaken] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.username, username)).limit(1);
  if (nameTaken) return { error: "That username is taken" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email: null, passwordHash, emailVerifiedAt: null }).returning();
    await tx.insert(profiles).values({ userId: user.id, username, displayName: parsed.data.displayName });
    return user.id;
  });
  await createWelcomeNotification(userId).catch(() => {});
  const next = safeRedirectPath(formData.get("next"), "/");
  await createAuthenticatedSession(userId);
  redirect(next === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`);
}

const loginSchema = z.object({ username: z.string(), password: z.string().min(1) });

export async function login(_prev: AuthState, formData: FormData): Promise<NonNullable<AuthState>> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your username and password" };
  const username = normalizeUsername(parsed.data.username);
  if (usernameValidationError(username)) return { error: "Invalid username or password" };

  const requestLimit = await checkRequestRateLimit({
    kind: "login_request",
    identifier: await requestFingerprint(),
    limit: 20,
    windowMs: 15 * 60_000,
    label: "login attempts",
  });
  if (requestLimit) return { error: requestLimit };
  const accountLimit = await checkRequestRateLimit({
    kind: "login_username",
    identifier: username,
    limit: 10,
    windowMs: 15 * 60_000,
    label: "login attempts for this account",
  });
  if (accountLimit) return { error: accountLimit };

  const [row] = await db
    .select({ user: users, onboardedAt: profiles.onboardedAt })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.username, username))
    .limit(1);
  const validPassword = await bcrypt.compare(parsed.data.password, row?.user.passwordHash ?? DUMMY_BCRYPT_HASH);
  if (!row?.user.passwordHash || !validPassword) return { error: "Invalid username or password" };
  if (row.user.bannedAt) return { error: "This account has been suspended." };

  await createAuthenticatedSession(row.user.id);
  const next = safeRedirectPath(formData.get("next"), "/");
  if (!row.onboardedAt) {
    redirect(next === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const setupSchema = z.object({ username: z.string(), password: z.string(), passwordConfirmation: z.string() });

export async function completeAccountSetup(_prev: AuthState, formData: FormData): Promise<NonNullable<AuthState>> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (sessionUser.hasPassword) redirect(sessionUser.profile.onboardedAt ? "/" : "/onboarding");
  if (!isRecentlyReauthenticated(sessionUser.reauthenticatedAt)) return { error: "Verify with Google again before completing setup." };

  const [googleAccount] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, sessionUser.id), eq(oauthAccounts.provider, "google")))
    .limit(1);
  if (!googleAccount) return { error: "A verified Google account is required to complete this setup." };

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const username = normalizeUsername(parsed.data.username);
  const usernameError = usernameValidationError(username);
  if (usernameError) return { error: usernameError };
  const passwordError = passwordValidationError(parsed.data.password, parsed.data.passwordConfirmation);
  if (passwordError) return { error: passwordError };

  const [taken] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.username, username), ne(profiles.userId, sessionUser.id)))
    .limit(1);
  if (taken) return { error: "That username is taken" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.transaction(async (tx) => {
    await tx.update(profiles).set({ username }).where(eq(profiles.userId, sessionUser.id));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, sessionUser.id));
  });

  const next = await consumePostAuthNext("/");
  if (!sessionUser.profile.onboardedAt) redirect(next === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`);
  redirect(next);
}

const changePasswordSchema = z.object({
  currentPassword: z.string().optional().default(""),
  password: z.string(),
  passwordConfirmation: z.string(),
});

export async function changePassword(_prev: AuthState, formData: FormData): Promise<NonNullable<AuthState>> {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.hasPassword) redirect(sessionUser ? "/account-setup" : "/login");
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const passwordError = passwordValidationError(parsed.data.password, parsed.data.passwordConfirmation);
  if (passwordError) return { error: passwordError };

  const limitError = await checkRequestRateLimit({
    kind: "password_change",
    identifier: sessionUser.id,
    limit: 10,
    windowMs: 60 * 60_000,
    label: "password change attempts",
  });
  if (limitError) return { error: limitError };

  const [account] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
  const currentPasswordValid = !!account?.passwordHash && !!parsed.data.currentPassword
    && await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
  if (!currentPasswordValid && !isRecentlyReauthenticated(sessionUser.reauthenticatedAt)) {
    return { error: "Enter your current password or verify with Google first." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, sessionUser.id));
    await tx.delete(sessions).where(eq(sessions.userId, sessionUser.id));
  });
  await createAuthenticatedSession(sessionUser.id);
  revalidatePath("/settings");
  return { ok: "Password updated. Other sessions were signed out." };
}

// Backward-compatible consumption for reset links issued before username-based
// recovery replaced email delivery. No live action creates new reset tokens.
const resetPasswordSchema = z.object({ token: z.string().min(32), password: z.string(), passwordConfirmation: z.string() });

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<NonNullable<AuthState>> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const passwordError = passwordValidationError(parsed.data.password, parsed.data.passwordConfirmation);
  if (passwordError) return { error: passwordError };
  const limitError = await checkRequestRateLimit({
    kind: "password_reset_submit",
    identifier: await requestFingerprint(parsed.data.token.slice(0, 16)),
    limit: 10,
    windowMs: 60 * 60_000,
    label: "password reset attempts",
  });
  if (limitError) return { error: limitError };

  const hash = tokenHash(parsed.data.token);
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const now = new Date();
  const userId = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, hash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .limit(1);
    if (!row) return null;
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.tokenHash, hash));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    return row.userId;
  });
  if (!userId) return { error: "That reset link is invalid or expired." };
  await createAuthenticatedSession(userId);
  redirect("/");
}
