import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMembers } from "@/db/schema";
import { isModerator } from "@/lib/permissions";

export type GroupRole = "member" | "moderator" | "owner";

/** This user's role in the group, or null if they aren't a member. */
export async function getGroupRole(userId: string, groupId: string): Promise<GroupRole | null> {
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return (m?.role as GroupRole | undefined) ?? null;
}

/** Who can moderate a group's posts and members: its owner, its group moderators,
 * or any platform moderator/admin (who can act on any group). Returns the basis so
 * callers can distinguish owner-level power (role changes, removing anyone) from a
 * group moderator's narrower reach. */
export async function getGroupAuthority(
  user: { id: string; role: string },
  groupId: string,
): Promise<{ canManage: boolean; ownerLevel: boolean; groupRole: GroupRole | null }> {
  const platformMod = isModerator(user);
  const groupRole = await getGroupRole(user.id, groupId);
  const ownerLevel = platformMod || groupRole === "owner";
  const canManage = ownerLevel || groupRole === "moderator";
  return { canManage, ownerLevel, groupRole };
}
