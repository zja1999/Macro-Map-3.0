import Link from "next/link";
import { initials } from "@/lib/utils";

export const inputCls =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-card-hover disabled:opacity-50";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-edge bg-card ${className}`}>{children}</div>;
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "accent";
}) {
  const tones = {
    default: "bg-surface text-ink-dim border-edge",
    good: "bg-accent/10 text-accent border-accent/30",
    warn: "bg-carbs/10 text-carbs border-carbs/30",
    accent: "bg-accent text-black border-accent font-semibold",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-dim font-bold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

export function UserChip({
  username,
  displayName,
  sub,
}: {
  username: string;
  displayName: string;
  sub?: string;
}) {
  return (
    <Link href={`/u/${username}`} className="flex items-center gap-2.5 group">
      <Avatar name={displayName} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold group-hover:text-accent">{displayName}</div>
        <div className="truncate text-xs text-ink-faint">@{username}{sub ? ` · ${sub}` : ""}</div>
      </div>
    </Link>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-edge py-12 text-center">
      <div className="text-sm font-medium text-ink-dim">{title}</div>
      {hint && <div className="max-w-xs text-xs text-ink-faint">{hint}</div>}
      {action}
    </div>
  );
}

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <div className="text-4xl">🚧</div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-ink-dim">
        This vertical ships in <span className="font-semibold text-accent">{phase}</span> of the build plan. The data
        model and design are done — see <code className="text-xs">docs/</code>.
      </p>
      <Link href="/" className={btnGhost}>
        Back to feed
      </Link>
    </div>
  );
}
