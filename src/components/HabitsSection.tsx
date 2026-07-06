"use client";

import { useState } from "react";
import { toggleHabit, updateHabit, archiveHabit, addHabit } from "@/actions/progress";
import { Card, inputCls } from "./ui";

type Habit = { id: string; name: string; emoji: string; doneToday: boolean; streak: number };

// Fixed narrow emoji field — must NOT reuse inputCls (its w-full conflicts).
const emojiInputCls =
  "w-12 shrink-0 rounded-lg border border-edge bg-surface px-2 py-2 text-center text-base leading-none text-ink focus:border-accent focus:outline-none";

export function HabitsSection({ habits, today, loggedDays }: { habits: Habit[]; today: string; loggedDays: number }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Daily habits</h2>
        <span className="text-[10px] text-ink-faint">tracked days this week: {loggedDays}/7 logged</span>
      </div>
      <ul className="space-y-2">
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} today={today} />
        ))}
      </ul>
      <form action={addHabit} className="mt-3 flex gap-2">
        <input name="emoji" defaultValue="✅" maxLength={12} aria-label="New habit emoji" className={emojiInputCls} />
        <input name="name" required minLength={2} maxLength={50} placeholder="Add a habit… (e.g. 10k steps)" className={inputCls} />
        <button className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">
          Add
        </button>
      </form>
    </Card>
  );
}

function HabitRow({ habit: h, today }: { habit: Habit; today: string }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-lg border border-edge bg-surface p-2">
      <div className="flex items-center gap-2">
        <form action={toggleHabit} className="min-w-0 flex-1">
          <input type="hidden" name="habitId" value={h.id} />
          <input type="hidden" name="logDate" value={today} />
          <button
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
              h.doneToday ? "bg-accent/10" : "hover:bg-card"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                h.doneToday ? "border-accent bg-accent text-black" : "border-edge"
              }`}
            >
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
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={`Edit ${h.name}`}
          aria-expanded={editing}
          className={`shrink-0 rounded-lg px-2 py-2 text-sm transition hover:bg-card ${
            editing ? "text-accent" : "text-ink-faint hover:text-ink"
          }`}
        >
          ✎
        </button>
      </div>

      {editing && (
        <div className="mt-2 flex gap-2">
          <form action={updateHabit} className="flex min-w-0 flex-1 gap-2">
            <input type="hidden" name="habitId" value={h.id} />
            <input
              name="emoji"
              defaultValue={h.emoji}
              maxLength={12}
              aria-label={`${h.name} emoji`}
              className={emojiInputCls}
            />
            <input
              name="name"
              defaultValue={h.name}
              required
              minLength={2}
              maxLength={50}
              aria-label={`${h.name} name`}
              className={inputCls}
            />
            <button className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">
              Save
            </button>
          </form>
          <form action={archiveHabit} className="shrink-0">
            <input type="hidden" name="habitId" value={h.id} />
            <button
              className="h-full rounded-lg px-2 text-ink-faint hover:bg-card hover:text-danger"
              aria-label={`Archive ${h.name}`}
            >
              ✕
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
