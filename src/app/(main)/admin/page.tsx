import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { moderationActions, reports, users } from "@/db/schema";
import { requireModerator, isAdmin } from "@/lib/permissions";
import { Card, Badge } from "@/components/ui";
import { AdminNav } from "@/components/AdminNav";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireModerator();
  const admin = isAdmin(user);

  const [[openReports], [recentActions], [userCount], [suspendedCount]] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` }).from(reports).where(eq(reports.status, "open")),
    db.select({ n: sql<number>`COUNT(*)` }).from(moderationActions),
    admin ? db.select({ n: sql<number>`COUNT(*)` }).from(users) : Promise.resolve([{ n: 0 }]),
    admin ? db.select({ n: sql<number>`COUNT(*)` }).from(users).where(sql`${users.bannedAt} IS NOT NULL`) : Promise.resolve([{ n: 0 }]),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-lg font-bold">Admin panel</h1>
        <p className="text-sm text-ink-dim">
          {admin
            ? "Admin access includes moderator tools, user management, nutrition imports, and the audit log."
            : "Moderator access includes reports, proactive content actions, and the audit log."}
        </p>
      </div>
      <AdminNav isAdmin={admin} />

      <div className="grid gap-3 sm:grid-cols-2">
        <PanelCard href="/admin/reports" title="Reports queue" value={Number(openReports.n)} label="open" />
        <PanelCard href="/admin/audit" title="Audit log" value={Number(recentActions.n)} label="actions" />
        {admin && <PanelCard href="/admin/users" title="Users" value={Number(userCount.n)} label="accounts" />}
        {admin && <PanelCard href="/admin/users?status=suspended" title="Suspensions" value={Number(suspendedCount.n)} label="suspended" />}
      </div>

      <Card className="space-y-2 p-4 text-sm text-ink-dim">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">admin</Badge>
          <span>can do everything a moderator can do, plus manage users and imports.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge>moderator</Badge>
          <span>can resolve reports, remove content, restore hidden posts/recipes, delete comments/posts/recipes, and add warning labels.</span>
        </div>
      </Card>
    </div>
  );
}

function PanelCard({ href, title, value, label }: { href: string; title: string; value: number; label: string }) {
  return (
    <Link href={href}>
      <Card className="p-4 transition hover:border-accent/40 hover:bg-card-hover">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-3 text-2xl font-black tabular-nums text-accent">{value}</div>
        <div className="text-xs text-ink-faint">{label}</div>
      </Card>
    </Link>
  );
}
