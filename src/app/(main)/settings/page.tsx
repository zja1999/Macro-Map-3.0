import { requireUser } from "@/lib/auth";
import { SettingsForms } from "@/components/SettingsForms";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Card } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-lg font-bold">Settings</h1>
      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Profile picture</h2>
        <AvatarUpload displayName={user.profile.displayName} currentAvatar={user.profile.avatarUrl} />
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
    </div>
  );
}
