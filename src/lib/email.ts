import { Resend } from "resend";

type SendVerificationEmailArgs = {
  to: string;
  verifyUrl: string;
};

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendVerificationEmail({ to, verifyUrl }: SendVerificationEmailArgs) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev";

  if (!resendKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] Verification link for ${to}: ${verifyUrl}`);
      return;
    }
    throw new Error("No email provider configured");
  }

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Verify your Macro Map email",
    html: `<p>Welcome to Macro Map.</p><p><a href="${verifyUrl}">Verify your email</a> to finish creating your account.</p><p>This link expires in 30 minutes.</p>`,
    text: `Verify your Macro Map email: ${verifyUrl}\n\nThis link expires in 30 minutes.`,
  });

  if (error) throw new Error(`Email provider rejected verification email: ${JSON.stringify(error)}`);
}
