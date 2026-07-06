"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, profiles, emailVerificationTokens } from "@/db/schema";
import { createSession, destroySession, sendEmailVerification } from "@/lib/auth";
import { checkRequestRateLimit, requestFingerprint } from "@/lib/rateLimit";

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

async function clearUnverifiedReservation(email: string, username: string) {
  const candidates = new Map<string, { emailVerifiedAt: Date | null }>();
  const [emailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (emailUser) candidates.set(emailUser.id, { emailVerifiedAt: emailUser.emailVerifiedAt });

  const [usernameUser] = await db
    .select({ user: users })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.username, username))
    .limit(1);
  if (usernameUser) candidates.set(usernameUser.user.id, { emailVerifiedAt: usernameUser.user.emailVerifiedAt });

  for (const [userId, candidate] of candidates) {
    if (candidate.emailVerifiedAt) continue;
    await db.delete(users).where(eq(users.id, userId));
  }
}

export async function register(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
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

  await clearUnverifiedReservation(email, username);

  const emailTaken = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (emailTaken[0]) return { error: "An account with that email already exists" };
  const nameTaken = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (nameTaken[0]) return { error: "That username is taken" };

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  await db.insert(profiles).values({ userId: user.id, username, displayName });
  try {
    await sendEmailVerification(user.id, email);
  } catch (err) {
    await db.delete(users).where(eq(users.id, user.id));
    console.error("[auth] Failed to send verification email", err);
    return { error: "We could not send the verification email. Please try again shortly." };
  }
  return { success: "Check your email to verify your account. The link expires in 30 minutes." };
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
    const [verificationToken] = await db
      .select({ tokenHash: emailVerificationTokens.tokenHash })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .limit(1);
    if (verificationToken) {
      return { error: "Please verify your email before signing in. You can resend the verification link below." };
    }
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  }
  await createSession(user.id);
  redirect("/");
}

const resendVerificationSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
});

export async function resendVerificationEmail(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const parsed = resendVerificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email" };

  const fingerprint = await requestFingerprint(parsed.data.email);
  const limitError = await checkRequestRateLimit({
    kind: "resend_verification",
    identifier: fingerprint,
    limit: 5,
    windowMs: 60 * 60_000,
    label: "verification email requests",
  });
  if (limitError) return { error: limitError };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user && !user.emailVerifiedAt && !user.bannedAt) {
    await sendEmailVerification(user.id, user.email);
  }

  return { success: "If that account needs verification, a new link is on the way." };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
// Guest/anonymous accounts were removed — logged-out visitors browse public
// content directly (see middleware.ts) and register a real account to interact.
