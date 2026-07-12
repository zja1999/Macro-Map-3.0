"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { emailVerificationTokens, passwordResetTokens, profiles, users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { sendAuthEmail } from "@/lib/authEmail";
import { newPublicToken, tokenHash } from "@/lib/authTokens";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";
import { createWelcomeNotification } from "@/lib/welcomeNotification";

const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, and underscores only")
    .transform((s) => s.toLowerCase()),
  displayName: z.string().min(1).max(40),
  password: z.string().min(8, "At least 8 characters"),
});

export async function register(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, username, displayName, password } = parsed.data;
  const fingerprint = await requestFingerprint(email);
  const limitError = await checkRequestRateLimit({
    kind: "register",
    identifier: fingerprint,
    limit: 5,
    windowMs: 60 * 60_000,
    label: "account creation attempts",
  });
  if (limitError) return { error: limitError };

  const emailTaken = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (emailTaken[0]) return { error: "An account with that email already exists" };
  const nameTaken = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (nameTaken[0]) return { error: "That username is taken" };

  const token = newPublicToken();
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash, emailVerifiedAt: null }).returning();
    await tx.insert(profiles).values({ userId: user.id, username, displayName });
    await tx.insert(emailVerificationTokens).values({
      tokenHash: tokenHash(token),
      userId: user.id,
      email,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    return user.id;
  });
  await createWelcomeNotification(userId).catch(() => {});
  await sendAuthEmail({ to: email, kind: "verify", token });
  redirect(`/verify-email/sent?email=${encodeURIComponent(email)}`);
}

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password" };
  const fingerprint = await requestFingerprint(parsed.data.email);
  const ipLimitError = await checkRequestRateLimit({
    kind: "login_ip",
    identifier: fingerprint,
    limit: 20,
    windowMs: 15 * 60_000,
    label: "login attempts",
  });
  if (ipLimitError) return { error: ipLimitError };
  const emailLimitError = await checkRequestRateLimit({
    kind: "login_email",
    identifier: parsed.data.email,
    limit: 10,
    windowMs: 15 * 60_000,
    label: "login attempts for this account",
  });
  if (emailLimitError) return { error: emailLimitError };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  if (user.bannedAt) {
    return { error: "This account has been suspended." };
  }
  if (!user.emailVerifiedAt) {
    const pending = await db
      .select({ tokenHash: emailVerificationTokens.tokenHash })
      .from(emailVerificationTokens)
      .where(and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt)))
      .limit(1);
    if (pending[0]) {
      return { error: "Check your email to verify this account before signing in." };
    }
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function resendVerification(
  _prev: { error?: string; ok?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const email = z.string().email().transform((s) => s.toLowerCase().trim()).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter your email address" };
  const limitError = await checkRequestRateLimit({
    kind: "resend_verification",
    identifier: await requestFingerprint(email.data),
    limit: 5,
    windowMs: 60 * 60_000,
    label: "verification emails",
  });
  if (limitError) return { error: limitError };

  const [user] = await db.select().from(users).where(eq(users.email, email.data)).limit(1);
  if (!user || user.emailVerifiedAt) return { ok: "If that account needs verification, a new link is on the way." };

  const token = newPublicToken();
  await db.insert(emailVerificationTokens).values({
    tokenHash: tokenHash(token),
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });
  await sendAuthEmail({ to: user.email, kind: "verify", token });
  return { ok: "If that account needs verification, a new link is on the way." };
}

export async function requestPasswordReset(
  _prev: { error?: string; ok?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const email = z.string().email().transform((s) => s.toLowerCase().trim()).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter your email address" };
  const limitError = await checkRequestRateLimit({
    kind: "password_reset_request",
    identifier: await requestFingerprint(email.data),
    limit: 5,
    windowMs: 60 * 60_000,
    label: "password reset emails",
  });
  if (limitError) return { error: limitError };

  const [user] = await db.select().from(users).where(eq(users.email, email.data)).limit(1);
  if (user?.passwordHash) {
    const token = newPublicToken();
    await db.insert(passwordResetTokens).values({
      tokenHash: tokenHash(token),
      userId: user.id,
      email: user.email,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    await sendAuthEmail({ to: user.email, kind: "reset", token });
  }

  return { ok: "If an account exists for that email, a reset link is on the way." };
}

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, "At least 8 characters"),
});

export async function resetPassword(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
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
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, hash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .limit(1);
    if (!row) return null;
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.tokenHash, hash));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    return row.userId;
  });
  if (!result) return { error: "That reset link is invalid or expired." };

  await createSession(result);
  redirect("/");
}
// Guest/anonymous accounts were removed — logged-out visitors browse public
// content directly (see middleware.ts) and register a real account to interact.
