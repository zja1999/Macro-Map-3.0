"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; primary?: boolean };

const tabs: NavItem[] = [
  { href: "/", label: "Feed", icon: "🏠" },
  { href: "/discover", label: "Discover", icon: "🔍" },
  { href: "/track/add", label: "Log", icon: "＋", primary: true },
  { href: "/track", label: "Track", icon: "📊" },
  { href: "/me", label: "Profile", icon: "👤" },
];

const adminLink: NavItem = { href: "/admin", label: "Admin", icon: "Admin" };

export function TabBar({ canModerate = false }: { canModerate?: boolean }) {
  const pathname = usePathname();
  const visibleTabs = canModerate ? [...tabs.slice(0, 4), adminLink, tabs[4]] : tabs;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {visibleTabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          if (t.primary) {
            return (
              <Link key={t.href} href={t.href} className="flex items-center px-3">
                <span className="flex h-11 w-11 -translate-y-3 items-center justify-center rounded-full bg-accent text-xl font-bold text-black shadow-lg shadow-accent/30">
                  {t.icon}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium ${
                active ? "text-accent" : "text-ink-faint"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileQuickActions() {
  const actions = [
    { href: "/track/add", label: "Meal" },
    { href: "/progress", label: "Weight" },
    { href: "/workouts/log", label: "Workout" },
    { href: "/restaurants", label: "Restaurants" },
  ];

  return (
    <div className="border-b border-edge bg-bg md:hidden">
      <div className="mx-auto flex max-w-lg gap-2 overflow-x-auto px-4 py-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="shrink-0 rounded-full border border-edge bg-card px-3 py-1.5 text-xs font-semibold text-ink-dim"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SideNav({ canModerate = false }: { canModerate?: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Feed", icon: "🏠" },
    { href: "/discover", label: "Discover", icon: "🔍" },
    { href: "/recipes", label: "Recipes", icon: "🍳" },
    { href: "/track", label: "Track", icon: "📊" },
    { href: "/meal-prep", label: "Meal Prep", icon: "🥡" },
    { href: "/restaurants", label: "Restaurants", icon: "🍔" },
    { href: "/workouts", label: "Workouts", icon: "🏋️" },
    { href: "/groups", label: "Groups", icon: "👥" },
    { href: "/challenges", label: "Challenges", icon: "🏆" },
    { href: "/progress", label: "Progress", icon: "📈" },
    { href: "/groceries", label: "Groceries", icon: "🛒" },
    { href: "/me", label: "Profile", icon: "👤" },
  ];
  const visibleLinks = canModerate ? [...links.slice(0, -1), adminLink, links[links.length - 1]] : links;
  return (
    <nav className="sticky top-16 hidden w-48 shrink-0 flex-col gap-0.5 md:flex">
      {visibleLinks.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-card text-accent" : "text-ink-dim hover:bg-card hover:text-ink"
            }`}
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
