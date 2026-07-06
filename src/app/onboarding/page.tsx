import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const metadata = { title: "Get set up" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile.onboardedAt) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="mb-8 text-2xl font-black tracking-tight">
        Macro<span className="text-accent">verse</span>
      </div>
      <OnboardingWizard />
    </main>
  );
}
