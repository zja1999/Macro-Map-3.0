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
  const isVerification = input.kind === "verify";
  const subject = isVerification ? "Verify your MacroVerse email" : "Reset your MacroVerse password";
  const heading = isVerification ? "Verify your email" : "Reset your password";
  const intro = isVerification
    ? "Thanks for creating a MacroVerse account. Confirm your email to finish setting it up."
    : "We received a request to reset your MacroVerse password.";
  const action = isVerification ? "Verify email" : "Reset password";

  if (process.env.NODE_ENV !== "production" || process.env.AUTH_EMAIL_MODE === "console") {
    console.log(`[auth-email] ${subject} for ${input.to}: ${link}`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("[auth-email] Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
    return;
  }

  const text = `${heading}\n\n${intro}\n\n${link}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f8;color:#1b1d21;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:#ffffff;border:1px solid #e4e6e8"><h1 style="margin:0 0 16px;font-size:24px">${heading}</h1><p style="line-height:1.5">${intro}</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:12px 18px;background:#197a62;color:#ffffff;text-decoration:none">${action}</a></p><p style="line-height:1.5">This link expires in 30 minutes. If you did not request this, you can ignore this email.</p></main></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text,
      html,
      ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[auth-email] Resend rejected ${input.kind} email (${response.status}): ${detail}`);
  }
}
