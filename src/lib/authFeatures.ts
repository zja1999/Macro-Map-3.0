export const EMAIL_PASSWORD_AUTH_DISABLED_MESSAGE =
  "Email and password authentication is unavailable. Continue with Google.";

/**
 * Email/password auth is fail-closed: only an explicit `true` enables it.
 * Keep this server-side so deployment configuration cannot leak into the client bundle.
 */
export function isEmailPasswordAuthEnabled(value = process.env.AUTH_EMAIL_PASSWORD_ENABLED) {
  return value?.trim().toLowerCase() === "true";
}

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
};

export function googleAuthErrorMessage(code: unknown) {
  return typeof code === "string" ? GOOGLE_AUTH_ERRORS[code] : undefined;
}
