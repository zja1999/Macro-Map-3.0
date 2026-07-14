import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts } from "@/db/schema";
import { getSessionUser, isRecentlyReauthenticated, requireUser } from "@/lib/auth";
import { googleAuthErrorMessage } from "@/lib/authFeatures";
import { SettingsForms } from "@/components/SettingsForms";
import { AccountSecurityForm } from "@/components/AccountSecurityForm";
import { AvatarUpload } from "@/components/AvatarUpload";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { Card, btnGhost } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string; reauthenticated?: string; recovery?: string; error?: string }> }) {
  const user = await requireUser();
  const sessionUser = await getSessionUser();
  const [googleAccount] = await db
    .select({ email: oauthAccounts.email })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, user.id), eq(oauthAccounts.provider, "google")))
    .limit(1);
  const params = await searchParams;
  const notice = params.google === "linked"
    ? "Google recovery is connected."
    : params.reauthenticated === "1" || params.recovery === "ready"
      ? "Google verification succeeded. You can choose a new password now."
      : undefined;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-lg font-bold">Settings</h1>
      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Profile picture</h2>
        <AvatarUpload displayName={user.profile.displayName} currentAvatar={user.profile.avatarUrl} />
      </Card>
      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Health integrations</h2>
          <p className="mt-1 text-xs text-ink-faint">Connect Strava/Fitbit now; Apple Health and Health Connect are ready for the mobile app.</p>
        </div>
        <Link href="/settings/integrations" className={btnGhost}>
          Manage
        </Link>
      </Card>
      <SettingsForms
        profile={{
          displayName: user.profile.displayName,
          bio: user.profile.bio ?? "",
          dietaryStyle: user.profile.dietaryStyle ?? "",
          shareMacroGoals: user.profile.shareMacroGoals,
          units: user.profile.units as "metric" | "imperial",
          goal: user.profile.goal ?? "maintenance",
          trackingStyle: user.profile.trackingStyle ?? "strict_macro",
          sex: user.profile.sex === "male" ? "male" : "female",
          heightCm: user.profile.heightCm ?? 170,
          weightKg: user.profile.weightKg ?? 75,
          birthYear: user.profile.birthYear ?? new Date().getFullYear() - 30,
          activityLevel: user.profile.activityLevel ?? "moderate",
        }}
        targets={{
          calories: user.targets?.calories ?? 2000,
          proteinG: user.targets?.proteinG ?? 150,
          carbsG: user.targets?.carbsG ?? 200,
          fatG: user.targets?.fatG ?? 65,
          isManual: user.targets?.isManual ?? false,
        }}
      />
      <AccountSecurityForm
        googleEmail={googleAccount?.email ?? null}
        recentlyReauthenticated={isRecentlyReauthenticated(sessionUser?.reauthenticatedAt ?? null)}
        notice={notice}
        error={googleAuthErrorMessage(params.error)}
      />
      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Your data and privacy</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Download a JSON copy of data tied to your account. Passwords, sessions, provider credentials, device tokens,
            internal storage keys, and other users&apos; private data are excluded.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" download className={btnGhost}>
            Download my data
          </a>
          <Link href="/privacy" className={btnGhost}>
            Read privacy policy
          </Link>
        </div>
      </Card>
      <Card className="border-danger/30 p-4">
        <DeleteAccountSection />
      </Card>
    </div>
  );
}
