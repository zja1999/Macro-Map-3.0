"use client";

import { useState } from "react";
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

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TabBar({ canModerate = false }: { canModerate?: boolean }) {
  const pathname = usePathname();
  const visibleTabs = canModerate ? [...tabs.slice(0, 4), adminLink, tabs[4]] : tabs;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {visibleTabs.map((t) => {
          const active = isActivePath(pathname, t.href);
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

type SideNavLeaf = { href: string; label: string; icon: string };
type SideNavGroup = { label: string; icon: string; children: SideNavLeaf[] };
type SideNavItem = SideNavLeaf | SideNavGroup;

const isGroup = (i: SideNavItem): i is SideNavGroup => "children" in i;

// Grouped so the rail reads by intent instead of a flat 12-item wall: eating
// (Food), logging + trends (Track), and social (Community) each collapse.
const NAV: SideNavItem[] = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/discover", label: "Discover", icon: "🔍" },
  {
    label: "Track",
    icon: "📊",
    children: [
      { href: "/track", label: "Food diary", icon: "🍽️" },
      { href: "/progress", label: "Progress", icon: "📈" },
    ],
  },
  {
    label: "Food",
    icon: "🥗",
    children: [
      { href: "/recipes", label: "Recipes", icon: "🍳" },
      { href: "/meal-prep", label: "Meal prep", icon: "🥡" },
      { href: "/restaurants", label: "Restaurants", icon: "🍔" },
      { href: "/groceries", label: "Groceries", icon: "🛒" },
    ],
  },
  { href: "/workouts", label: "Workouts", icon: "🏋️" },
  {
    label: "Community",
    icon: "👥",
    children: [
      { href: "/groups", label: "Groups", icon: "🤝" },
      { href: "/challenges", label: "Challenges", icon: "🏆" },
    ],
  },
  { href: "/me", label: "Profile", icon: "👤" },
];

const leafCls = (active: boolean) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
    active ? "bg-card text-accent" : "text-ink-dim hover:bg-card hover:text-ink"
  }`;

export function SideNav({ canModerate = false }: { canModerate?: boolean }) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const items: SideNavItem[] = canModerate ? [...NAV, { href: "/admin", label: "Admin", icon: "🛡" }] : NAV;

  return (
    <nav className="sticky top-16 hidden w-52 shrink-0 flex-col gap-0.5 md:flex">
      {items.map((item) => {
        if (!isGroup(item)) {
          return (
            <Link key={item.href} href={item.href} className={leafCls(isActivePath(pathname, item.href))}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        }
        const hasActive = item.children.some((c) => isActivePath(pathname, c.href));
        const open = overrides[item.label] ?? hasActive;
        return (
          <div key={item.label}>
            <button
              type="button"
              onClick={() => setOverrides((o) => ({ ...o, [item.label]: !open }))}
              aria-expanded={open}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                hasActive && !open ? "text-accent" : "text-ink-dim hover:bg-card hover:text-ink"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              <span className={`ml-auto text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>›</span>
            </button>
            {open && (
              <div className="ml-3 flex flex-col gap-0.5 border-l border-edge pl-2">
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} className={leafCls(isActivePath(pathname, c.href))}>
                    <span className="text-sm">{c.icon}</span>
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
