import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moderationActions, profiles } from "@/db/schema";
import { requireModerator, isAdmin } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { Card, Badge } from "@/components/ui";
import { AdminNav } from "@/components/AdminNav";

export const metadata = { title: "Admin - Audit log" };

export default async function AdminAuditPage() {
  const user = await requireModerator();
  const rows = await db
    .select({ action: moderationActions, actor: profiles.username })
    .from(moderationActions)
    .leftJoin(profiles, eq(profiles.userId, moderationActions.actorId))
    .orderBy(desc(moderationActions.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-lg font-bold">Audit log</h1>
        <p className="text-sm text-ink-dim">Every moderation and admin action is recorded here.</p>
      </div>
      <AdminNav isAdmin={isAdmin(user)} />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-faint">No audit actions yet.</p>
        ) : (
          <ul className="divide-y divide-edge text-sm">
            {rows.map(({ action, actor }) => (
              <li key={action.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{action.kind.replace(/_/g, " ")}</Badge>
                  <Badge tone="warn">{action.subjectType}</Badge>
                  <span className="text-xs text-ink-faint">{timeAgo(action.createdAt)}</span>
                </div>
                <div className="text-ink-dim">
                  <span className="font-medium text-ink">{actor ? `@${actor}` : "Deleted user"}</span> acted on{" "}
                  <Link href={hrefFor(action.subjectType, action.subjectId)} className="font-mono text-xs text-accent hover:underline">
                    {action.subjectId}
                  </Link>
                </div>
                <p className="text-xs text-ink-faint">{action.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function hrefFor(subjectType: string, subjectId: string) {
  if (subjectType === "post") return `/posts/${subjectId}`;
  if (subjectType === "recipe") return `/recipes/${subjectId}`;
  return "/admin/audit";
}
