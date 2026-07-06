import { requireUser } from "@/lib/auth";
import { getProgressEntries, getProgressPhotos, getHabitsWithStreaks, getWeekSummary, getSleepLogs } from "@/lib/queries";
import { ensureDefaultHabits, toggleHabit, addHabit, archiveHabit } from "@/actions/progress";
import { logSleep, deleteSleepLog } from "@/actions/sleep";
import { todayStr, formatDateLabel } from "@/lib/utils";
import { formatWeight, formatLength, kgToLb, type UnitsPref } from "@/lib/units";
import { Card, EmptyState, inputCls } from "@/components/ui";
import { ProgressPhotoForm, WeighInForm } from "@/components/ProgressForms";

export const metadata = { title: "Progress" };

function WeightChart({ points, units }: { points: { date: string; kg: number }[]; units: UnitsPref }) {
  const W = 560;
  const H = 150;
  const PAD = 6;
  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = Math.max(0.5, max - min);
  const x = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
  const y = (kg: number) => PAD + (1 - (kg - min) / span) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weight trend">
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={2.5} fill="var(--color-accent)">
          <title>{`${p.date}: ${formatWeight(p.kg, units)}`}</title>
        </circle>
      ))}
      <text x={W - PAD} y={y(points[points.length - 1].kg) - 8} textAnchor="end" fontSize={11} fill="var(--color-ink)" fontWeight="bold">
        {formatWeight(points[points.length - 1].kg, units)}
      </text>
    </svg>
  );
}

export default async function ProgressPage() {
  const user = await requireUser();
  const today = todayStr();
  await ensureDefaultHabits(user.id);

  const [entries, photos, habitList, week, sleep] = await Promise.all([
    getProgressEntries(user.id),
    getProgressPhotos(user.id),
    getHabitsWithStreaks(user.id, today),
    getWeekSummary(user.id, today),
    getSleepLogs(user.id, 14),
  ]);
  const sleepAvgMin = sleep.length
    ? Math.round(sleep.reduce((a, s) => a + s.durationMin, 0) / sleep.length)
    : null;
  const fmtSleep = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

  const units = user.profile.units as UnitsPref;
  const weightPoints = entries.filter((e) => e.weightKg != null).map((e) => ({ date: e.entryDate, kg: e.weightKg! }));
  const latest = entries[entries.length - 1];
  const firstWeight = weightPoints[0]?.kg;
  const lastWeight = weightPoints[weightPoints.length - 1]?.kg;
  const delta = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null;

  const latestOf = (key: "waistCm" | "chestCm" | "hipsCm" | "armsCm" | "bodyFatPct") => {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i][key] != null) return entries[i][key];
    return null;
  };
  const measurements = (
    [
      ["bodyFatPct", "Body fat", "pct"],
      ["waistCm", "Waist", "length"],
      ["chestCm", "Chest", "length"],
      ["hipsCm", "Hips", "length"],
      ["armsCm", "Arms", "length"],
    ] as const
  )
    .map(([key, label, kind]) => ({
      label,
      value: latestOf(key),
      display:
        latestOf(key) == null
          ? null
          : kind === "pct"
            ? `${latestOf(key)}%`
            : formatLength(latestOf(key), units),
    }))
    .filter((m) => m.value != null);

  const loggedDays = week.length;

  // No-scale mode (docs/07 §4): weight prompts, charts, and measurements are
  // suppressed globally — habits and adherence carry the page instead.
  const noScale = user.profile.trackingStyle === "no_scale";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-base font-bold">📈 Progress</h1>

      {noScale && (
        <p className="rounded-xl border border-edge bg-card px-4 py-3 text-xs text-ink-dim">
          You&apos;re tracking <span className="font-semibold text-accent">scale-free</span> — progress here is habits
          and consistency, not weight. You can change this any time in your tracking style.
        </p>
      )}

      {/* weigh-in */}
      {!noScale && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {latest?.entryDate === today ? "Today's entry (edits merge in)" : "Log a weigh-in"}
          </h2>
          <WeighInForm today={today} units={units} />
        </Card>
      )}

      {/* weight trend */}
      {!noScale && (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Weight trend</h2>
            {delta != null && weightPoints.length >= 2 && (
              <span className={`text-xs font-semibold tabular-nums ${delta <= 0 ? "text-accent" : "text-carbs"}`}>
                {(() => {
                  const d = units === "imperial" ? kgToLb(delta) : delta;
                  return `${d > 0 ? "+" : ""}${d.toFixed(1)} ${units === "imperial" ? "lb" : "kg"}`;
                })()}{" "}
                since {formatDateLabel(weightPoints[0].date)}
              </span>
            )}
          </div>
          {weightPoints.length >= 2 ? (
            <WeightChart points={weightPoints} units={units} />
          ) : (
            <p className="py-4 text-center text-xs text-ink-faint">
              Log two or more weigh-ins to see your trend line.
            </p>
          )}
        </Card>
      )}

      {/* measurements */}
      {!noScale && measurements.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Latest measurements</h2>
          <div className="flex flex-wrap gap-2">
            {measurements.map((m) => (
              <div key={m.label} className="rounded-lg bg-surface px-3 py-2 text-center">
                <div className="text-sm font-bold tabular-nums">{m.display}</div>
                <div className="text-[10px] text-ink-faint">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* habits (docs/08 §1b) — each with its own streak */}
      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Daily habits</h2>
          <span className="text-[10px] text-ink-faint">tracked days this week: {loggedDays}/7 logged</span>
        </div>
        <ul className="space-y-2">
          {habitList.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2">
              <form action={toggleHabit} className="min-w-0 flex-1">
                <input type="hidden" name="habitId" value={h.id} />
                <input type="hidden" name="logDate" value={today} />
                <button
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    h.doneToday ? "border-accent/40 bg-accent/10" : "border-edge bg-surface hover:border-ink-faint"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${h.doneToday ? "border-accent bg-accent text-black" : "border-edge"}`}>
                    {h.doneToday ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {h.emoji} {h.name}
                  </span>
                  {h.streak > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-carbs" title={`${h.streak}-day streak`}>
                      🔥 {h.streak}
                    </span>
                  )}
                </button>
              </form>
              {!h.isDefault && (
                <form action={archiveHabit}>
                  <input type="hidden" name="habitId" value={h.id} />
                  <button className="px-1 text-ink-faint hover:text-danger" aria-label={`Archive ${h.name}`}>
                    ✕
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={addHabit} className="mt-3 flex gap-2">
          <input name="name" required minLength={2} maxLength={50} placeholder="Add a habit… (e.g. 10k steps)" className={inputCls} />
          <button className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">
            Add
          </button>
        </form>
      </Card>

      {/* sleep (docs/10 §4) — manual tier; synced sleep lands in the same rows later */}
      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">😴 Sleep</h2>
          {sleepAvgMin != null && (
            <span className="text-[10px] text-ink-faint">
              avg {fmtSleep(sleepAvgMin)} over {sleep.length} night{sleep.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <form action={logSleep} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[10px] text-ink-dim">
            Woke up on
            <input type="date" name="sleepDate" defaultValue={today} max={today} required className={inputCls} />
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Bed
            <input type="time" name="bedTime" defaultValue="23:00" required className={inputCls} />
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Woke
            <input type="time" name="wakeTime" defaultValue="07:00" required className={inputCls} />
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Quality
            <select name="quality" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((q) => (
                <option key={q} value={q}>
                  {q}/5
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">
            Save
          </button>
        </form>
        {sleep.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {sleep.slice(0, 7).map((s) => (
              <li key={s.sleepDate} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-ink-faint">{formatDateLabel(s.sleepDate)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent/70"
                    style={{ width: `${Math.min(100, (s.durationMin / 600) * 100)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right tabular-nums">{fmtSleep(s.durationMin)}</span>
                <span className="w-7 shrink-0 text-right text-ink-faint">{s.quality != null ? `${s.quality}/5` : ""}</span>
                <form action={deleteSleepLog}>
                  <input type="hidden" name="sleepDate" value={s.sleepDate} />
                  <button className="px-1 text-ink-faint hover:text-danger" aria-label="Delete sleep entry">
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Private photos</h2>
          <span className="text-[10px] text-ink-faint">{photos.length} attached</span>
        </div>
        <ProgressPhotoForm today={today} />
        {photos.length > 0 && (
          <ul className="mt-3 divide-y divide-edge">
            {photos.map(({ photo, entryDate }) => (
              <li key={photo.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">{photo.storageKey}</div>
                  <div className="text-[10px] text-ink-faint">
                    {formatDateLabel(entryDate)} · {photo.mimeType}
                    {photo.width && photo.height ? ` · ${photo.width}x${photo.height}` : ""}
                  </div>
                </div>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                  private
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* history */}
      {!noScale && entries.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">History</h2>
          <ul className="divide-y divide-edge">
            {[...entries].reverse().slice(0, 14).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between py-1.5 text-sm">
                <span className="text-xs text-ink-faint">{formatDateLabel(e.entryDate)}</span>
                <span className="tabular-nums">
                  {e.weightKg != null && <span className="font-medium">{formatWeight(e.weightKg, units)}</span>}
                  {e.bodyFatPct != null && <span className="ml-2 text-xs text-ink-dim">{e.bodyFatPct}% bf</span>}
                  {e.waistCm != null && (
                    <span className="ml-2 text-xs text-ink-dim">{formatLength(e.waistCm, units)} waist</span>
                  )}
                  {e.note && <span className="ml-2 text-xs italic text-ink-faint">“{e.note}”</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : !noScale ? (
        <EmptyState title="No entries yet" hint="Weigh-ins, measurements, and habits all live here — private by default." />
      ) : null}

      <p className="text-center text-[10px] text-ink-faint">Everything on this page is private by default.</p>
    </div>
  );
}
