"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, profiles } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";

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
  await createSession(user.id);
  redirect("/onboarding");
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

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  if (user.bannedAt) {
    return { error: "This account has been suspended." };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
// Guest/anonymous accounts were removed — logged-out visitors browse public
// content directly (see middleware.ts) and register a real account to interact.
