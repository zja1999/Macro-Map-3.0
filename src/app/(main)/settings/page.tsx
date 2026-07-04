import { getCurrentUser } from "@/lib/auth";
import { SettingsForms } from "@/components/SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-lg font-bold">Settings</h1>
      <SettingsForms
        profile={{
          displayName: user.profile.displayName,
          bio: user.profile.bio ?? "",
          dietaryStyle: user.profile.dietaryStyle ?? "",
          shareMacroGoals: user.profile.shareMacroGoals,
        }}
        targets={{
          calories: user.targets?.calories ?? 2000,
          proteinG: user.targets?.proteinG ?? 150,
          carbsG: user.targets?.carbsG ?? 200,
          fatG: user.targets?.fatG ?? 65,
        }}
      />
    </div>
  );
}
