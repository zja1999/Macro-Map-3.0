import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, moderationActions, posts, profiles, recipes, reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { resolveReport } from "@/actions/moderation";
import { Card, Badge, inputCls } from "@/components/ui";

export const metadata = { title: "Admin · Reports" };

// safety reasons jump the line (docs/07 §2.2)
const SAFETY = ["ed_content", "unsafe_advice", "harassment", "body_shaming"];

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) redirect("/");

  const open = await db
    .select({ report: reports, reporter: profiles.username })
    .from(reports)
    .innerJoin(profiles, eq(profiles.userId, reports.reporterId))
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.createdAt))
    .limit(100);
  const sorted = [...open].sort(
    (a, b) => Number(SAFETY.includes(b.report.reason)) - Number(SAFETY.includes(a.report.reason)),
  );

  // subject previews, batched per type
  const idsOf = (t: string) => sorted.filter((r) => r.report.subjectType === t).map((r) => r.report.subjectId);
  const [postRows, recipeRows, commentRows] = await Promise.all([
    idsOf("post").length ? db.select().from(posts).where(inArray(posts.id, idsOf("post"))) : [],
    idsOf("recipe").length ? db.select().from(recipes).where(inArray(recipes.id, idsOf("recipe"))) : [],
    idsOf("comment").length ? db.select().from(comments).where(inArray(comments.id, idsOf("comment"))) : [],
  ]);
  const preview = new Map<string, { text: string; href: string | null; hidden: boolean }>();
  for (const p of postRows) preview.set(p.id, { text: p.body ?? "(no text)", href: `/posts/${p.id}`, hidden: p.isRemoved });
  for (const r of recipeRows) preview.set(r.id, { text: r.name, href: `/recipes/${r.id}`, hidden: r.status === "removed" });
  for (const c of commentRows) preview.set(c.id, { text: c.body, href: null, hidden: false });

  const recentActions = await db
    .select({ action: moderationActions, actor: profiles.username })
    .from(moderationActions)
    .innerJoin(profiles, eq(profiles.userId, moderationActions.actorId))
    .orderBy(desc(moderationActions.createdAt))
    .limit(15);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">🛡 Reports queue</h1>
        <Link href="/admin/imports" className="text-xs text-accent hover:underline">
          Nutrition imports →
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge py-10 text-center text-sm text-ink-faint">
          Queue is clear. 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ report, reporter }) => {
            const p = preview.get(report.subjectId);
            const isSafety = SAFETY.includes(report.reason);
            return (
              <Card key={report.id} className={`space-y-2 p-3 ${isSafety ? "border-danger/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={isSafety ? "warn" : "default"}>{report.reason.replace(/_/g, " ")}</Badge>
                  <Badge>{report.subjectType}</Badge>
                  {p?.hidden && <Badge tone="warn">already hidden</Badge>}
                  <span className="text-ink-faint">
                    by @{reporter} · {timeAgo(report.createdAt)}
                  </span>
                </div>
                <p className="rounded-lg bg-surface px-3 py-2 text-xs text-ink-dim">
                  {p ? (
                    <>
                      “{p.text.slice(0, 200)}
                      {p.text.length > 200 && "…"}”{" "}
                      {p.href && (
                        <Link href={p.href} className="text-accent hover:underline">
                          view →
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="italic">subject no longer exists</span>
                  )}
                </p>
                {report.detail && <p className="text-xs text-ink-faint">Reporter note: {report.detail}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action" value="dismiss" />
                    <button className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink">
                      Dismiss
                    </button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action" value="remove" />
                    <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">
                      Remove content
                    </button>
                  </form>
                  <form action={resolveReport} className="flex items-center gap-1.5">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="action" value="warn_label" />
                    <select name="warningKind" className={`${inputCls} w-auto py-1.5 text-xs`}>
                      <option value="misinformation">misinformation</option>
                      <option value="unsafe_diet">unsafe diet</option>
                      <option value="unverified_macros">unverified macros</option>
                    </select>
                    <button className="rounded-lg border border-carbs/40 bg-carbs/10 px-2.5 py-1.5 text-xs font-semibold text-carbs">
                      Label
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* immutable audit log (docs/07 §1) */}
      {recentActions.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Audit log</h2>
          <ul className="divide-y divide-edge text-xs">
            {recentActions.map(({ action, actor }) => (
              <li key={action.id} className="py-1.5 text-ink-dim">
                <span className="font-medium">@{actor}</span> · {action.kind.replace(/_/g, " ")} ·{" "}
                {action.subjectType} · <span className="text-ink-faint">{action.reason}</span>{" "}
                <span className="text-ink-faint">({timeAgo(action.createdAt)})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
