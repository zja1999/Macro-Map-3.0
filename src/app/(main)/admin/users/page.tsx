import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { banUser, deleteUser, setUserRole, unbanUser } from "@/actions/admin";
import { canManageUser, requireAdmin } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { AdminNav } from "@/components/AdminNav";
import { Badge, Card, inputCls } from "@/components/ui";

export const metadata = { title: "Admin - Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const suspendedOnly = sp.status === "suspended";

  const conditions = [
    ...(q
      ? [
          or(
            ilike(users.email, `%${q}%`),
            ilike(profiles.username, `%${q}%`),
            ilike(profiles.displayName, `%${q}%`),
          ),
        ]
      : []),
    ...(suspendedOnly ? [sql`${users.bannedAt} IS NOT NULL`] : []),
  ];

  const rows = await db
    .select({ user: users, profile: profiles })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(conditions.length ? sql.join(conditions, sql` AND `) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-lg font-bold">Users</h1>
        <p className="text-sm text-ink-dim">Admins can change roles, suspend accounts, revoke sessions, and delete ordinary user profiles.</p>
      </div>
      <AdminNav isAdmin />

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search email, username, or name" className={`${inputCls} min-w-64 flex-1`} />
        {suspendedOnly && <input type="hidden" name="status" value="suspended" />}
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">Search</button>
      </form>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-ink-faint">No users found.</Card>
        ) : (
          rows.map(({ user, profile }) => {
            const manageable = canManageUser(admin, user);
            return (
              <Card key={user.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{profile.displayName}</span>
                      <span className="text-sm text-ink-faint">@{profile.username}</span>
                      <Badge tone={user.role === "admin" ? "accent" : user.role === "moderator" ? "warn" : "default"}>{user.role}</Badge>
                      {user.bannedAt && <Badge tone="warn">suspended</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-ink-faint">
                      {user.email ?? "No email"} - joined {timeAgo(user.createdAt)} - {user.reputation} rep
                    </div>
                    {user.bannedReason && <p className="mt-2 text-xs text-danger">Reason: {user.bannedReason}</p>}
                  </div>
                  {!manageable && <span className="text-xs text-ink-faint">Protected account</span>}
                </div>

                {manageable && (
                  <div className="flex flex-wrap gap-2">
                    <form action={setUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="role" defaultValue={user.role} className={`${inputCls} w-auto py-1.5 text-xs`}>
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                      <button className="rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-dim hover:text-ink">
                        Set role
                      </button>
                    </form>

                    {user.bannedAt ? (
                      <form action={unbanUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent">
                          Unsuspend
                        </button>
                      </form>
                    ) : (
                      <form action={banUser} className="flex min-w-64 flex-1 items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input name="reason" maxLength={300} placeholder="Suspension reason" className={`${inputCls} py-1.5 text-xs`} />
                        <button className="rounded-lg border border-carbs/40 bg-carbs/10 px-2.5 py-1.5 text-xs font-semibold text-carbs">
                          Suspend
                        </button>
                      </form>
                    )}

                    {user.role === "user" && (
                      <form action={deleteUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">
                          Delete profile
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
