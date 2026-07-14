import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Flame } from "lucide-react";
import { getCurrentUser, getSessionUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getStreak, getUnreadNotificationCount, getFrequents } from "@/lib/queries";
import { todayStr, slotForNow } from "@/lib/utils";
import { TabBar, SideNav } from "@/components/TabBar";
import type { LogSheetData } from "@/components/LogSheet";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Avatar } from "@/components/ui";
import { syncAutomaticBadgesForUser } from "@/lib/badges";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Logged-out visitors reach this layout only for public pages (middleware gates
  // the rest), so render an anonymous shell instead of forcing a login.
  const sessionUser = await getSessionUser();
  if (sessionUser && !sessionUser.hasPassword) redirect("/account-setup");
  const user = await getCurrentUser();
  if (user && !user.profile.onboardedAt) redirect("/onboarding");
  if (user) await syncAutomaticBadgesForUser(user.id);
  const [streak, unreadNotifications, frequents] = user
    ? await Promise.all([
        getStreak(user.id, todayStr()),
        getUnreadNotificationCount(user.id),
        getFrequents(user.id, 3),
      ])
    : [0, 0, []];
  const canModerate = !!user && isModerator(user);

  // Serializable payload for the client-side Log sheet (SQL AVGs come back as
  // strings from pg — coerce here, not in the component).
  const logSheet: LogSheetData | undefined = user
    ? {
        trackingStyle: user.profile.trackingStyle,
        today: todayStr(),
        slot: slotForNow(),
        frequents: frequents.map((f) => ({
          name: f.name,
          calories: Number(f.calories),
          proteinG: Number(f.proteinG),
          carbsG: Number(f.carbsG),
          fatG: Number(f.fatG),
        })),
      }
    : undefined;

  return (
    <div className="min-h-dvh pb-20 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={user ? "/" : "/recipes"} className="text-lg font-black tracking-tight">
            Macro<span className="text-accent">verse</span>
          </Link>
          {user ? (
            <div className="flex items-center gap-4">
              <FeedbackButton />
              <Link href="/notifications" className="relative text-text-secondary transition hover:text-accent" aria-label="Notifications">
                <Bell size={20} strokeWidth={1.8} />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-black">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
              {streak > 0 && (
                <span
                  className="flex items-center gap-0.5 text-sm font-bold tabular-nums text-carbs"
                  title={`${streak}-day logging streak`}
                >
                  <Flame size={16} strokeWidth={2.2} fill="currentColor" /> {streak}
                </span>
              )}
              <Link href={`/u/${user.profile.username}`} aria-label="Your profile">
                <Avatar name={user.profile.displayName} size={30} src={user.profile.avatarUrl} />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Link href="/login" className="font-semibold text-ink-dim hover:text-ink">
                Log in
              </Link>
              <Link href="/register" className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-black">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl gap-8 px-4 pt-6">
        <SideNav canModerate={canModerate} authed={!!user} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <TabBar authed={!!user} logSheet={logSheet} />
    </div>
  );
}
