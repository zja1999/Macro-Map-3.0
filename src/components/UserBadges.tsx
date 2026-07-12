import type { DisplayBadge } from "@/lib/badges";

export function BadgeIcon({ badge, size = 18 }: { badge: DisplayBadge; size?: number }) {
  const image = badge.icon.startsWith("data:image/");
  return (
    <span
      title={`${badge.name} — ${badge.description}`}
      aria-label={`${badge.name} badge`}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full align-middle"
      style={{ width: size, height: size, fontSize: size * 0.78 }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- compact admin-supplied data URL
        <img src={badge.icon} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        badge.icon
      )}
    </span>
  );
}

export function UserBadges({ badges, limit = 5, size = 18 }: { badges: DisplayBadge[]; limit?: number; size?: number }) {
  if (!badges.length) return null;
  const visible = badges.slice(0, limit);
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`${badges.length} earned badge${badges.length === 1 ? "" : "s"}`}>
      {visible.map((badge) => <BadgeIcon key={badge.id} badge={badge} size={size} />)}
      {badges.length > visible.length && <span className="text-[10px] font-medium text-ink-faint">+{badges.length - visible.length}</span>}
    </span>
  );
}
