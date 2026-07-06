import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, type CurrentUser } from "@/lib/auth";

/* Role hierarchy (docs/07): user < moderator < admin. Admin is a strict superset —
 * anything a moderator can do, an admin can too. Gate on the capability
 * (isModerator / isAdmin), never on an exact role string, so the hierarchy holds. */

export type Role = "user" | "moderator" | "admin";
const RANK: Record<string, number> = { user: 0, moderator: 1, admin: 2 };

export const rankOf = (role: string) => RANK[role] ?? 0;
export const isModerator = (u: { role: string }) => rankOf(u.role) >= RANK.moderator;
export const isAdmin = (u: { role: string }) => rankOf(u.role) >= RANK.admin;

/** Page guard: moderator or admin, else bounce home. */
export async function requireModerator(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isModerator(user)) redirect("/");
  return user;
}

/** Page guard: admin only, else bounce home. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/");
  return user;
}

/** Action guard: current user must be admin. Throws (server actions surface as errors). */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new Error("Admins only");
  return user;
}

/** Action guard: current user must be a moderator or admin. */
export async function assertModerator(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isModerator(user)) throw new Error("Moderators only");
  return user;
}

/** Whether `actor` may ban/delete/role-change `target`. Never yourself; you can only
 * act on someone strictly below your rank (so admins can't nuke each other, and a
 * privileged target must be demoted before removal — which also avoids orphaning
 * their audit-log entries). */
export function canManageUser(actor: { id: string; role: string }, target: { id: string; role: string }): boolean {
  if (actor.id === target.id) return false;
  return rankOf(actor.role) > rankOf(target.role);
}
