# Operations

## Environment selection

`DATABASE_URL` is the main environment switch:

- present: node-postgres connects to hosted Postgres;
- absent: PGlite persists at `.data/pglite`.

The switch applies to the app, Drizzle schema commands, seed scripts, and admin CLI. Always inspect the environment before running a mutating command.

## Environment variable catalog

| Variable | Required for | Behavior when absent |
|---|---|---|
| `DATABASE_URL` | Hosted Postgres | Uses local PGlite |
| `NEXT_PUBLIC_APP_URL` | Canonical email/OAuth callback base | Some code falls back to `VERCEL_URL` or request origin; Google config needs a usable base |
| `VERCEL_URL` | Deployment URL fallback | Only used where explicit app URL is absent |
| `AUTH_EMAIL_MODE=console` | Force logged auth links | Non-production already logs links |
| `RESEND_API_KEY` | Production auth email delivery | Production logs configuration error and cannot deliver |
| `RESEND_FROM_EMAIL` | Verified sender | Required with Resend key |
| `RESEND_REPLY_TO` | Optional email reply-to | Omitted |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in | Google start route reports unavailable |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth | Provider shows not configured |
| `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET` | Fitbit OAuth | Provider shows not configured |
| `HEALTH_TOKEN_ENCRYPTION_KEY` | Stable health token encryption | Falls back through `AUTH_SECRET`, `DATABASE_URL`, then insecure dev constant |
| `AUTH_SECRET` | Secondary encryption-key fallback | Not otherwise the app-session secret; sessions use random tokens |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Strava webhook verification | Verification fails/not configured |
| `<PROVIDER>_WEBHOOK_SECRET` | Generic webhook secret lookup | Provider-specific fallback may apply |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | Push delivery | Push silently unavailable/best-effort |
| `CAP_SERVER_URL` | Capacitor target override at config/build time | Loads production URL |
| `NODE_ENV` | Cookie security, email mode, PWA registration, CSP development allowance | Managed by Next/npm |
| `R2_ENDPOINT` | Private production progress-photo storage | Local/test uses `.data/media`; production fails media operations clearly |
| `R2_BUCKET` | Private R2 bucket name | Same as above |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Bucket-scoped object read/write/delete credentials | Same as above |

Never place server secrets in `NEXT_PUBLIC_*` variables.

## Private media rollout

Create a non-public R2 bucket and a bucket-scoped token limited to object read, write, and delete. Configure all four `R2_*` variables together; partial configuration is not accepted in production, and object URLs are never exposed to clients. Development and automated tests use `.data/media` when R2 is absent.

Run `npm run media:audit` as a dry run before migration or deployment. It reports database rows with missing objects, objects without database rows, and legacy metadata-only rows; it never deletes them. Roll out in this order: configure the bucket/token, verify local upload/view/download/delete/comparison, audit and review legacy rows, configure production secrets, deploy, perform authenticated desktop/mobile smoke tests, and verify account deletion removes database rows and objects.

## Deploying web and schema

Application deployment does not apply database schema. A safe release order for additive schema changes is:

1. Confirm backups/recovery for the hosted database.
2. Build and verify the commit locally.
3. Set the intended production `DATABASE_URL` in a controlled shell.
4. Run `npm run db:push` and review Drizzle prompts/output carefully.
5. Run `npm run db:seed:reference` only if new reference tables/data need bootstrap.
6. Deploy the compatible web application.
7. Smoke-test auth and the affected domain; inspect platform/database/provider logs.

For breaking schema changes, design a compatibility rollout rather than relying on a single `push`. The repository does not currently contain a migration history with expand/backfill/contract orchestration.

## Seeding safety

`scripts/seed.ts` has two modes:

- full demo mode: destructive reset/recreation of application data plus reference content;
- `--reference-only`: insert-only bootstrap of foods, chains/menu items, exercises, and workout templates, skipping already non-empty reference groups.

Hosted full demo mode is refused unless `--force-demo` is passed. That flag is an emergency/deliberate test-environment override, not a production deployment step.

## Auth provider rollout

For production email and Google sign-in:

1. Apply the current schema including verification/reset and `oauth_accounts` tables.
2. Configure Resend variables with a verified sender domain/address.
3. Configure Google client credentials and canonical `NEXT_PUBLIC_APP_URL`.
4. Register `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback` as a Google redirect URI and the base URL as an authorized origin where required.
5. Test new registration, verification, resend, password reset, new Google user, existing verified-email linking, state mismatch, denial, and callback failure.

Development console links are not evidence of production email delivery.

## Health provider rollout

Before enabling a provider publicly:

- configure client credentials and exact callback URL `/api/integrations/<provider>/callback`;
- set a stable health-token encryption key;
- confirm requested scopes and provider review requirements;
- implement/verify access-token refresh;
- configure and verify webhook subscriptions where continuous sync is claimed;
- run first-connect, backfill, duplicate replay, expiry, disconnect/reconnect, and manual-data precedence tests;
- monitor `integration_sync_runs` and account status messages.

Current provider gaps are recorded in [Platform and integrations](platform-and-integrations.md).

## Android release prerequisites

Development builds use Android Studio tooling. A store release additionally needs:

- completed Google Play identity/account verification;
- a user-created, securely backed-up release keystore and `android/keystore.properties` signing config;
- signed AAB generation with Java 21/Android tooling;
- Google/Firebase config as needed for enabled native capabilities;
- Play App Signing SHA-256 added to deployed `public/.well-known/assetlinks.json`;
- privacy policy, store listing, and data-safety declarations;
- production web deployment and deep-link/native smoke tests.

Do not commit keystores, keystore passwords, or `google-services.json`.

iOS is not present as a native project. It requires macOS/Xcode and an Apple Developer account; an iOS release with Google sign-in also requires Sign in with Apple policy compliance.

## Incident and diagnostic notes

- **Local database locked:** stop all Node/dev/build/test processes using PGlite, then retry one command at a time.
- **Build attempts a database query:** server modules use a fail-fast database proxy during Next production-build analysis. Keep request-dependent routes dynamic; do not bypass the guard by opening PGlite directly from a page/module initializer.
- **PGlite WASM warnings after build:** a current clean build should not initialize PGlite and should not emit `RuntimeError: unreachable` or `Aborted()`. Confirm `src/db/client.ts` is the only application driver entry point and `NEXT_PHASE` is not being overwritten.
- **Installed Android app shows old web behavior:** confirm the web deployment; the shell does not bundle current `src`.
- **OAuth callback fails:** check canonical URL, provider redirect URI, state cookie, secure-cookie context, schema, and provider credentials.
- **Auth email absent:** distinguish console mode from production, then inspect Resend configuration/response logs and sender verification.
- **Integration sync errors:** inspect latest `integration_sync_runs`, account status message, token expiry/decryption key, scopes, and provider response.
- **Browser blocks remote content:** inspect CSP console errors and update `next.config.ts` narrowly.

## Release verification baseline

Run the commands in [Testing](testing.md), then perform focused production smoke tests for auth, privacy-policy reachability, authenticated export, diary snapshot logging, the changed domain, admin access boundaries, anonymous public browsing, and Android remote-shell behavior when relevant. Add and verify a real public privacy contact method before public/store launch; do not publish a placeholder address. Record actual results in [Status and roadmap](status-and-roadmap.md), not aspirational statements.
