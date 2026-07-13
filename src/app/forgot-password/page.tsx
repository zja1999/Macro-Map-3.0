import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { GoogleSignInCard } from "@/components/GoogleSignInCard";
import { isEmailPasswordAuthEnabled } from "@/lib/authFeatures";

export default function ForgotPasswordPage() {
  if (!isEmailPasswordAuthEnabled()) {
    return <GoogleSignInCard next="" heading="Sign in with Google" message="Password recovery is unavailable while Google is the only sign-in method." />;
  }
  return <ForgotPasswordForm />;
}
