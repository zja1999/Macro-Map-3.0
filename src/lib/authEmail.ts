type AuthEmailKind = "verify" | "reset";

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function authLink(kind: AuthEmailKind, token: string) {
  const path = kind === "verify" ? "/verify-email" : "/reset-password";
  return `${appUrl()}${path}?token=${encodeURIComponent(token)}`;
}

export async function sendAuthEmail(input: { to: string; kind: AuthEmailKind; token: string }) {
  const link = authLink(input.kind, input.token);
  const label = input.kind === "verify" ? "Email verification" : "Password reset";

  // Provider wiring is intentionally deferred until Zach chooses Resend/Postmark/etc.
  // This keeps the full auth flow testable locally without an external account.
  if (process.env.NODE_ENV !== "production" || process.env.AUTH_EMAIL_MODE === "console") {
    console.log(`[auth-email] ${label} for ${input.to}: ${link}`);
    return;
  }

  console.warn(`[auth-email] ${label} requested for ${input.to}, but no email provider is configured.`);
}
