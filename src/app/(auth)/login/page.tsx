import { LoginForm } from "@/components/LoginForm";
import { GoogleSignInCard } from "@/components/GoogleSignInCard";
import { googleAuthErrorMessage, isEmailPasswordAuthEnabled } from "@/lib/authFeatures";
import { safeRedirectPath } from "@/lib/safeRedirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, "");
  const googleError = googleAuthErrorMessage(params.error);
  if (!isEmailPasswordAuthEnabled()) return <GoogleSignInCard next={next} error={googleError} />;
  return <LoginForm next={next} googleError={googleError} />;
}
