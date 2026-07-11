# Email Verification and Google OAuth Plan

This plan keeps the existing `sessions` table as the single logged-in session layer. Email/password,
verified email, and Google OAuth all end by calling `createSession(userId)`.

## Current Status (2026-07-10)

- Email verification and password-reset flows are implemented. Production delivery uses Resend when
  `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured; local development logs links instead.
- Google OAuth routes and auth-screen entry points are implemented. They require the
  `oauth_accounts` database table plus `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  `NEXT_PUBLIC_APP_URL` in the deployed environment.
- Google identity links only trust Google accounts whose email is verified. Existing password accounts
  are linked only when their local email has already been verified.

## Goals

- Verify email ownership during account creation before granting full account trust.
- Add Google as an optional sign-in and registration path.
- Preserve existing email/password login for users who prefer it.
- Support future provider additions without replacing the session system.

## Schema Changes

Add an email verification table:

```ts
email_verification_tokens
- token_hash text primary key
- user_id uuid references users(id) on delete cascade
- email text not null
- expires_at timestamptz not null
- used_at timestamptz
- created_at timestamptz default now()
```

Add Google identity links:

```ts
oauth_accounts
- provider text not null
- provider_account_id text not null
- user_id uuid references users(id) on delete cascade
- email text
- created_at timestamptz default now()
- primary key (provider, provider_account_id)
```

Add user email state:

```ts
users.email_verified_at timestamptz
users.password_hash nullable
```

`password_hash` becomes nullable so Google-only accounts do not need a local password.

## Email Verification Flow

1. User submits register form.
2. Create `users` + `profiles` with `email_verified_at = null`.
3. Generate a 32-byte random token, store only `sha256(token)`, and expire it in 30 minutes.
4. Send a verification link: `/verify-email?token=...`.
5. Verification route hashes the token, checks unused + unexpired, sets `users.email_verified_at`, marks token used, and creates a session.
6. Login blocks unverified email/password accounts and offers a resend path.

Operational notes:
- Rate-limit register, login, verify, and resend flows.
- Keep error messages generic enough to avoid account enumeration.
- Use a transactional outbox or provider webhook later if email delivery needs retries.

## Google OAuth Flow

Environment:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

Routes:

- `GET /api/auth/google/start`
  - Creates a random `state` cookie.
  - Redirects to Google with `openid email profile`.
- `GET /api/auth/google/callback`
  - Verifies `state`.
  - Exchanges `code` for tokens.
  - Reads Google `sub`, `email`, `email_verified`, and display name.
  - Looks up `oauth_accounts(provider='google', provider_account_id=sub)`.
  - Existing OAuth account: create session.
  - Matching verified email user: link Google account, create session.
  - New user: create `users`, `profiles`, `oauth_accounts`, set `email_verified_at` if Google says verified, create session.

Security notes:
- Require `email_verified === true` before trusting a Google email for linking.
- Store no Google access token unless the app needs Google APIs beyond sign-in.
- Keep OAuth `state` httpOnly, sameSite lax, secure in production, short-lived.
- Reject callback if the configured app URL does not match the registered redirect URI.

## Product Decisions To Make

- Whether registration should immediately create a limited unverified session or wait until email verification.
- Whether existing unverified users can browse public pages only, or use the full app with a persistent verification banner.
- Which email provider to use first: Resend, Postmark, SendGrid, SES, or Vercel marketplace integration.
- Whether Google-created accounts may add a password later from Settings.

## Suggested Implementation Order

1. Add schema fields and token tables.
2. Add email sender abstraction and provider env docs.
3. Implement verification email on register and resend.
4. Add `/verify-email` route and unverified login handling.
5. Add Google OAuth routes and buttons on login/register.
6. Add e2e coverage for register, verify, login, Google callback failure, and account linking.
