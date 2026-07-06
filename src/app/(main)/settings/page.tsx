import { requireUser } from "@/lib/auth";
import { SettingsForms, ClaimAccountForm, FeedbackForm } from "@/components/SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string }>;
}) {
  const user = await requireUser();
  const { claimed } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-lg font-bold">Settings</h1>
      {claimed && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          🎉 Account claimed — you can now sign in from any device.
        </p>
      )}
      {user.isGuest && <ClaimAccountForm />}
      <SettingsForms
        profile={{
          displayName: user.profile.displayName,
          bio: user.profile.bio ?? "",
          dietaryStyle: user.profile.dietaryStyle ?? "",
          shareMacroGoals: user.profile.shareMacroGoals,
          units: user.profile.units as "metric" | "imperial",
        }}
        targets={{
          calories: user.targets?.calories ?? 2000,
          proteinG: user.targets?.proteinG ?? 150,
          carbsG: user.targets?.carbsG ?? 200,
          fatG: user.targets?.fatG ?? 65,
        }}
      />
      <FeedbackForm />
    </div>
  );
}
