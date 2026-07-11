import Link from "next/link";
import { Construction } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-accent text-black hover:brightness-110",
        ghost: "border border-border bg-surface-2 font-medium text-text hover:bg-surface-3",
        soft: "bg-accent/10 text-accent hover:bg-accent/20",
        danger: "bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "w-full px-4 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
  {
    variants: {
      selected: {
        true: "border-accent bg-accent/15 text-accent",
        false: "border-border bg-surface-2 text-text-secondary hover:text-text",
      },
    },
    defaultVariants: { selected: false },
  }
);

/** Legacy class strings (pre-cva). Prefer <Button>/<Input> in new code. */
export const inputCls =
  "w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none";

export const btnPrimary = buttonVariants({ variant: "primary", size: "md" });

export const btnGhost = buttonVariants({ variant: "ghost", size: "md" });

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

export function Avatar({ name, size = 36, src }: { name: string; size?: number; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- data-URL avatar, next/image can't optimize it
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
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
  avatarUrl,
}: {
  username: string;
  displayName: string;
  sub?: string;
  avatarUrl?: string | null;
}) {
  return (
    <Link href={`/u/${username}`} className="flex items-center gap-2.5 group">
      <Avatar name={displayName} src={avatarUrl} />
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
      <Construction size={40} strokeWidth={1.5} className="text-accent" />
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
