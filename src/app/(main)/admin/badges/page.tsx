import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { badges, userBadges } from "@/db/schema";
import { assignBadge, createBadge, deleteBadge, revokeBadge, updateBadge } from "@/actions/adminBadges";
import { BADGE_METRICS, type BadgeMetric } from "@/lib/badges";
import { requireAdmin } from "@/lib/permissions";
import { isMissingTableError } from "@/lib/dbErrors";
import { AdminNav } from "@/components/AdminNav";
import { BadgeIconInput } from "@/components/BadgeIconInput";
import { BadgeIcon } from "@/components/UserBadges";
import { UsernameAutocomplete } from "@/components/UsernameAutocomplete";
import { Card, inputCls } from "@/components/ui";

export const metadata = { title: "Admin - Badges" };

async function getBadgeDefinitions() {
  try {
    return await db
      .select({ badge: badges, awards: sql<number>`count(${userBadges.userId})` })
      .from(badges)
      .leftJoin(userBadges, eq(userBadges.badgeId, badges.id))
      .groupBy(badges.id)
      .orderBy(desc(badges.createdAt));
  } catch (error) {
    if (isMissingTableError(error, "badges") || isMissingTableError(error, "user_badges")) return null;
    throw error;
  }
}

function CriteriaFields({ metric, threshold }: { metric?: string | null; threshold?: number | null }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block space-y-1 text-xs text-ink-dim">Automatic metric
        <select name="metric" defaultValue={metric ?? ""} className={inputCls}>
          <option value="">None for manual badges</option>
          {Object.entries(BADGE_METRICS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs text-ink-dim">Threshold<input name="threshold" type="number" min={1} max={1_000_000} defaultValue={threshold ?? ""} className={inputCls} /></label>
    </div>
  );
}

export default async function AdminBadgesPage() {
  await requireAdmin();
  const definitions = await getBadgeDefinitions();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-lg font-bold">Badges</h1>
        <p className="text-sm text-ink-dim">Create achievement badges, upload their icons, and choose automatic milestones or manual assignment.</p>
      </div>
      <AdminNav isAdmin />

      {definitions === null ? (
        <Card className="space-y-2 border-carbs/40 bg-carbs/10 p-4">
          <h2 className="font-semibold text-carbs">Hosted database update required</h2>
          <p className="text-sm text-ink-dim">The badge tables are not present in the database used by this deployment. Run <code className="rounded bg-surface px-1.5 py-0.5 text-xs">npm run db:push</code> from the deployed commit with that database&apos;s <code className="rounded bg-surface px-1.5 py-0.5 text-xs">DATABASE_URL</code> set, then reload this page.</p>
        </Card>
      ) : (
        <>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Create badge</h2>
        <form action={createBadge} className="space-y-3">
          <BadgeIconInput />
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="name" required minLength={2} maxLength={50} placeholder="Badge name" className={inputCls} />
            <select name="awardMode" defaultValue="manual" className={inputCls}><option value="manual">Manual assignment</option><option value="automatic">Automatic milestone</option></select>
          </div>
          <textarea name="description" required minLength={2} maxLength={240} rows={2} placeholder="What this badge recognizes" className={`${inputCls} resize-none`} />
          <CriteriaFields />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Visible and awardable</label>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">Create badge</button>
        </form>
      </Card>

      <div className="space-y-3">
        {definitions.map(({ badge, awards }) => (
          <Card key={badge.id} className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <BadgeIcon badge={badge} size={38} />
              <div className="min-w-0 flex-1"><div className="font-semibold">{badge.name}</div><div className="text-sm text-ink-dim">{badge.description}</div><div className="text-xs text-ink-faint">{badge.awardMode}{badge.metric ? ` · ${BADGE_METRICS[badge.metric as BadgeMetric]} ≥ ${badge.threshold}` : ""} · {Number(awards)} awarded</div></div>
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-accent">Edit badge</summary>
              <form action={updateBadge} className="mt-3 space-y-3">
                <input type="hidden" name="badgeId" value={badge.id} />
                <BadgeIconInput initial={badge.icon} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input name="name" required maxLength={50} defaultValue={badge.name} className={inputCls} />
                  <select name="awardMode" defaultValue={badge.awardMode} className={inputCls}><option value="manual">Manual assignment</option><option value="automatic">Automatic milestone</option></select>
                </div>
                <textarea name="description" required maxLength={240} rows={2} defaultValue={badge.description} className={`${inputCls} resize-none`} />
                <CriteriaFields metric={badge.metric} threshold={badge.threshold} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={badge.isActive} /> Visible and awardable</label>
                <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black">Save changes</button>
              </form>
            </details>

            <div className="grid gap-2 border-t border-edge pt-3 sm:grid-cols-2">
              <form action={assignBadge} className="flex gap-2"><input type="hidden" name="badgeId" value={badge.id} /><UsernameAutocomplete name="target" required maxLength={120} placeholder="username or email" allowEmail className={`${inputCls} py-1.5 text-xs`} wrapperClassName="min-w-0 flex-1" /><button className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 text-xs font-semibold text-accent">Assign</button></form>
              <form action={revokeBadge} className="flex gap-2"><input type="hidden" name="badgeId" value={badge.id} /><UsernameAutocomplete name="target" required maxLength={120} placeholder="username or email" allowEmail className={`${inputCls} py-1.5 text-xs`} wrapperClassName="min-w-0 flex-1" /><button className="rounded-lg border border-carbs/40 bg-carbs/10 px-2.5 text-xs font-semibold text-carbs">Revoke</button></form>
            </div>
            <form action={deleteBadge}><input type="hidden" name="badgeId" value={badge.id} /><button className="text-xs font-semibold text-danger">Delete badge and its awards</button></form>
          </Card>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
