# Next Steps

Work is currently in launch hardening, not core-feature construction. Complete the items in this order.

## 1. Finish production authentication

The code for Resend email and Google OAuth is complete locally. Before relying on either feature:

1. Deploy the current branch to Vercel.
2. Run `npm run db:push` against the production Neon `DATABASE_URL`. This creates `oauth_accounts` alongside the existing email-verification and password-reset tables.
3. In Vercel Production, set or confirm:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` using a Resend-verified sender
   - optional `RESEND_REPLY_TO`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_APP_URL` set to the canonical production URL
4. In Google Cloud Console, add `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback` as an authorized redirect URI and the base URL as an authorized JavaScript origin.
5. Test a new email registration, verification link, password reset, new Google account, and Google linking to an existing verified email account.

## 2. Launch essentials

- Add and publish a `/privacy` page before a public mobile-store release.
- Review account deletion and data-export behavior against the privacy policy.
- Run the end-to-end suite against a clean database and add focused coverage for email verification, password reset, and Google callback failures.
- Confirm the production deployment, database, and Resend logs are monitored during the first real-user tests.

## Deferred by choice

- Push notifications: do not configure or test Firebase/FCM now. The code can remain dormant until it becomes a product priority.
- Play Store release: resume only after Google Play identity verification is complete. Then create a release keystore, configure signed AAB builds, add the Play signing SHA-256 to `public/.well-known/assetlinks.json`, and complete listing/privacy/data-safety work.
- iOS: blocked on a Mac and an Apple Developer account. Before an iOS release with Google sign-in, add Sign in with Apple.
- Live health integrations: before enabling Strava/Fitbit, implement token refresh, webhook subscription management, full provider normalizers, and user-facing sync controls. CSV imports and native health bridges remain later work.
