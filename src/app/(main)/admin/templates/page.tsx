import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workouts } from "@/db/schema";
import { requireAdmin, isAdmin } from "@/lib/permissions";
import { deleteOfficialTemplate } from "@/actions/workouts";
import { Card, Badge, EmptyState, btnPrimary } from "@/components/ui";
import { AdminNav } from "@/components/AdminNav";

export const metadata = { title: "Admin · Templates" };

export default async function AdminTemplatesPage() {
  const user = await requireAdmin();

  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.isTemplate, true), eq(workouts.status, "published")))
    .orderBy(asc(workouts.title));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">🏋 Official templates</h1>
        <Link href="/admin/templates/new" className={btnPrimary}>
          + New template
        </Link>
      </div>

      <AdminNav isAdmin={isAdmin(user)} />

      <p className="text-xs text-ink-faint">
        The starter shelf every member sees under Workouts → Templates. Edits and removals apply to everyone.
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No official templates yet" hint="Create one to seed the community's starter shelf." />
      ) : (
        <div className="space-y-2">
          {rows.map((w) => (
            <Card key={w.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/workouts/${w.id}`} className="text-sm font-medium hover:text-accent">
                  {w.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                  <Badge>{w.kind}</Badge>
                  {w.difficulty && <Badge>difficulty {w.difficulty}/5</Badge>}
                  {w.estDurationMin && <Badge>~{w.estDurationMin} min</Badge>}
                  <span>
                    {w.structure.length} movement{w.structure.length === 1 ? "" : "s"}
                  </span>
                  {w.completedCount > 0 && <span>· completed {w.completedCount}x</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/templates/${w.id}/edit`}
                  className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs font-semibold text-ink-dim hover:text-ink"
                >
                  Edit
                </Link>
                <form action={deleteOfficialTemplate}>
                  <input type="hidden" name="templateId" value={w.id} />
                  <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">
                    Delete
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
