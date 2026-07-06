import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getStreak, getUnreadNotificationCount } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { MobileQuickActions, TabBar, SideNav } from "@/components/TabBar";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Avatar } from "@/components/ui";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Logged-out visitors reach this layout only for public pages (middleware gates
  // the rest), so render an anonymous shell instead of forcing a login.
  const user = await getCurrentUser();
  if (user && !user.profile.onboardedAt) redirect("/onboarding");
  const [streak, unreadNotifications] = user
    ? await Promise.all([getStreak(user.id, todayStr()), getUnreadNotificationCount(user.id)])
    : [0, 0];
  const canModerate = !!user && isModerator(user);

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
              <Link href="/notifications" className="relative text-sm font-semibold text-ink-dim hover:text-accent" aria-label="Notifications">
                🔔
                {unreadNotifications > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1.5 text-[10px] leading-4 text-black">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
              {streak > 0 && (
                <span className="text-sm font-semibold text-carbs" title={`${streak}-day logging streak`}>
                  🔥 {streak}
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
      {user && <MobileQuickActions />}
      <div className="mx-auto flex max-w-5xl gap-8 px-4 pt-6">
        <SideNav canModerate={canModerate} authed={!!user} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <TabBar canModerate={canModerate} authed={!!user} />
    </div>
  );
}
