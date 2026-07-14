import { redirect } from "next/navigation";
import { AccountSetupForm } from "@/components/AccountSetupForm";
import { getSessionUser, isRecentlyReauthenticated } from "@/lib/auth";
import { googleAuthErrorMessage } from "@/lib/authFeatures";

export const metadata = { title: "Secure your account" };

export default async function AccountSetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  if (sessionUser.hasPassword) redirect(sessionUser.profile.onboardedAt ? "/" : "/onboarding");
  const currentUsername = sessionUser.profile.username.startsWith("google_") ? "" : sessionUser.profile.username;
  return (
    <AccountSetupForm
      username={currentUsername}
      canSubmit={isRecentlyReauthenticated(sessionUser.reauthenticatedAt)}
      googleError={googleAuthErrorMessage((await searchParams).error)}
    />
  );
}
