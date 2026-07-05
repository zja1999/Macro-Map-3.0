import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStreak } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { TabBar, SideNav } from "@/components/TabBar";
import { Avatar } from "@/components/ui";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile.onboardedAt) redirect("/onboarding");
  const streak = await getStreak(user.id, todayStr());

  return (
    <div className="min-h-dvh pb-20 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-edge bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-black tracking-tight">
            Macro<span className="text-accent">Map</span>
          </Link>
          <div className="flex items-center gap-4">
            {streak > 0 && (
              <span className="text-sm font-semibold text-carbs" title={`${streak}-day logging streak`}>
                🔥 {streak}
              </span>
            )}
            <Link href={`/u/${user.profile.username}`} aria-label="Your profile">
              <Avatar name={user.profile.displayName} size={30} />
            </Link>
          </div>
        </div>
      </header>
      {user.isGuest && (
        <div className="border-b border-accent/30 bg-accent/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-xs">
            <span className="text-ink-dim">
              👋 You&apos;re in <span className="font-semibold text-ink">guest mode</span> — your data lives on this
              device only.
            </span>
            <Link href="/settings#claim" className="shrink-0 font-semibold text-accent hover:underline">
              Save your progress →
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-5xl gap-8 px-4 pt-6">
        <SideNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
