const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  google_not_configured:
    "Google sign-in is not configured for this deployment. Please try again later or contact support.",
  google_state_invalid:
    "Your Google sign-in session expired or could not be verified. Start Google sign-in again.",
  google_sign_in_failed:
    "Google sign-in could not be completed. Try again or choose another Google account.",
  google_email_not_verified:
    "That Google account does not have a verified email address. Choose a verified Google account.",
  google_account_unavailable:
    "That Google account cannot be used here. Try another verified Google account or contact support.",
  google_recovery_unavailable:
    "That Google account is not linked for recovery. Sign in with your username or use a previously linked Google account.",
  google_link_conflict:
    "That Google account is already connected elsewhere and cannot be linked.",
  google_reauthentication_failed:
    "Google could not verify this account for the requested security change. Try again.",
};

export function googleAuthErrorMessage(code: unknown) {
  return typeof code === "string" ? GOOGLE_AUTH_ERRORS[code] : undefined;
}
