import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nutritionImportBatches, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { Card } from "@/components/ui";
import { AdminImportForm } from "@/components/AdminImportForm";

export const metadata = { title: "Admin · Nutrition imports" };

export default async function AdminImportsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/");

  const batches = await db
    .select({ batch: nutritionImportBatches, username: profiles.username })
    .from(nutritionImportBatches)
    .innerJoin(profiles, eq(profiles.userId, nutritionImportBatches.uploadedBy))
    .orderBy(desc(nutritionImportBatches.createdAt))
    .limit(30);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-base font-bold">🛠 Nutrition data import</h1>
      <p className="text-xs text-ink-dim">
        Paste CSV from chain nutrition pages or USDA exports. Rows are validated (required fields, numeric sanity,
        4/4/9 consistency) and deduplicated against the file and existing data. Every batch is logged below.
      </p>

      <AdminImportForm />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-dim">Upload history</h2>
        {batches.length === 0 && <p className="text-xs text-ink-faint">No imports yet.</p>}
        {batches.map(({ batch, username }) => (
          <Card key={batch.id} className="p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {batch.filename} → <code>{batch.target}</code>
              </span>
              <span className="text-ink-faint">
                @{username} · {timeAgo(batch.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex gap-3 tabular-nums text-ink-dim">
              <span>{batch.rowCount} rows</span>
              <span className="text-accent">{batch.insertedCount} inserted</span>
              <span>{batch.duplicateCount} dupes skipped</span>
              <span className={batch.errorCount ? "text-danger" : ""}>{batch.errorCount} errors</span>
            </div>
            {Array.isArray(batch.errors) && batch.errors.length > 0 && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-ink-faint">error detail</summary>
                <ul className="mt-1 space-y-0.5 text-danger">
                  {(batch.errors as { row: number; message: string }[]).slice(0, 20).map((e, i) => (
                    <li key={i}>
                      row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
