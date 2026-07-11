"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  ChevronRight,
  Compass,
  Dumbbell,
  Home,
  LineChart,
  MapPin,
  Package,
  Shield,
  ShoppingCart,
  Trophy,
  User,
  Users,
  UtensilsCrossed,
  Salad,
  type LucideIcon,
} from "lucide-react";
import { LogSheet, type LogSheetData } from "@/components/LogSheet";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Center slot is the LogSheet trigger, not a tab — logging is an action, not a
// destination (plan §2.2). Admin lives under You + SideNav, never in the bar.
const tabsLeft: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
];
const tabsRight: NavItem[] = [
  { href: "/track", label: "Track", icon: BarChart3 },
  { href: "/me", label: "You", icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/me") return pathname === "/me" || pathname.startsWith("/u/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const publicTabs: NavItem[] = [
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/restaurants", label: "Food", icon: MapPin },
  { href: "/login", label: "Log in", icon: User },
];

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium ${
        active ? "text-accent" : "text-text-tertiary"
      }`}
    >
      <item.icon size={22} strokeWidth={active ? 2.4 : 1.8} />
      {item.label}
    </Link>
  );
}

export function TabBar({ authed = true, logSheet }: { authed?: boolean; logSheet?: LogSheetData }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1/95 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {!authed ? (
          publicTabs.map((t) => <Tab key={t.href} item={t} active={isActivePath(pathname, t.href)} />)
        ) : (
          <>
            {tabsLeft.map((t) => (
              <Tab key={t.href} item={t} active={isActivePath(pathname, t.href)} />
            ))}
            {logSheet && <LogSheet data={logSheet} />}
            {tabsRight.map((t) => (
              <Tab key={t.href} item={t} active={isActivePath(pathname, t.href)} />
            ))}
          </>
        )}
      </div>
    </nav>
  );
}

type SideNavLeaf = { href: string; label: string; icon: LucideIcon };
type SideNavGroup = { label: string; icon: LucideIcon; children: SideNavLeaf[] };
type SideNavItem = SideNavLeaf | SideNavGroup;

const isGroup = (i: SideNavItem): i is SideNavGroup => "children" in i;

// Grouped so the rail reads by intent instead of a flat 12-item wall: eating
// (Food), logging + trends (Track), and social (Community) each collapse.
const NAV: SideNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  {
    label: "Track",
    icon: BarChart3,
    children: [
      { href: "/track", label: "Food diary", icon: UtensilsCrossed },
      { href: "/progress", label: "Progress", icon: LineChart },
    ],
  },
  {
    label: "Food",
    icon: Salad,
    children: [
      { href: "/recipes", label: "Recipes", icon: ChefHat },
      { href: "/meal-prep", label: "Meal prep", icon: Package },
      { href: "/restaurants", label: "Restaurants", icon: MapPin },
      { href: "/groceries", label: "Groceries", icon: ShoppingCart },
    ],
  },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  {
    label: "Community",
    icon: Users,
    children: [
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/challenges", label: "Challenges", icon: Trophy },
    ],
  },
  { href: "/me", label: "Profile", icon: User },
];

// what logged-out visitors can browse (mirrors middleware's PUBLIC_PREFIXES)
const PUBLIC_NAV: SideNavLeaf[] = [
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/restaurants", label: "Restaurants", icon: MapPin },
  { href: "/meal-prep", label: "Meal prep", icon: Package },
  { href: "/discover", label: "Discover", icon: Compass },
];

const leafCls = (active: boolean) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
    active ? "bg-surface-2 text-accent" : "text-text-secondary hover:bg-surface-2 hover:text-text"
  }`;

export function SideNav({ canModerate = false, authed = true }: { canModerate?: boolean; authed?: boolean }) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  if (!authed) {
    return (
      <nav className="sticky top-16 hidden w-52 shrink-0 flex-col gap-0.5 md:flex">
        {PUBLIC_NAV.map((l) => (
          <Link key={l.href} href={l.href} className={leafCls(isActivePath(pathname, l.href))}>
            <l.icon size={18} strokeWidth={1.8} />
            {l.label}
          </Link>
        ))}
        <Link
          href="/login"
          className="mt-2 rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-black"
        >
          Log in / Sign up
        </Link>
      </nav>
    );
  }

  const items: SideNavItem[] = canModerate ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;

  return (
    <nav className="sticky top-16 hidden w-52 shrink-0 flex-col gap-0.5 md:flex">
      {items.map((item) => {
        if (!isGroup(item)) {
          return (
            <Link key={item.href} href={item.href} className={leafCls(isActivePath(pathname, item.href))}>
              <item.icon size={18} strokeWidth={1.8} />
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
                hasActive && !open ? "text-accent" : "text-text-secondary hover:bg-surface-2 hover:text-text"
              }`}
            >
              <item.icon size={18} strokeWidth={1.8} />
              {item.label}
              <ChevronRight
                size={14}
                className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
            {open && (
              <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                {item.children.map((c) => (
                  <Link key={c.href} href={c.href} className={leafCls(isActivePath(pathname, c.href))}>
                    <c.icon size={16} strokeWidth={1.8} />
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
