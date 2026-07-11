# Agent Handoff

## Current product state

MacroVerse is a Next.js 15 application with Drizzle/Postgres and a Capacitor Android shell. The web app is deployed at `https://macroverse.vercel.app`; the Android shell uses that deployed URL, not the local `src/` bundle. Any web change must be deployed before it can be observed inside the installed Android app.

Core web product work is complete. The current active engineering task is production-auth verification: Resend delivery and Google OAuth were added locally on 2026-07-10/11, but the `oauth_accounts` production migration and real-provider smoke tests still need completion.

## Important implementation points

- Sessions are app-owned: random cookie token, SHA-256 token hash, Postgres session record. Do not replace this with a provider session.
- Auth lives in `src/actions/auth.ts`, `src/lib/auth.ts`, `src/lib/authEmail.ts`, and `src/lib/googleAuth.ts`.
- Google routes are `src/app/api/auth/google/start/route.ts` and `src/app/api/auth/google/callback/route.ts`.
- Google identities are stored in `oauth_accounts`. Only a Google account with `email_verified` may be trusted. An existing local account is linked only if its own email is already verified.
- Resend is called directly through its REST API; no dependency was added. In local development email links are logged. Production requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Push has code and Android/Firebase setup, but it is not a current priority. Do not add push work unless Zach explicitly reopens it.

## Environment and commands

- Node is installed at `C:\Program Files\nodejs` and may not be on PATH. Use `& 'C:\Program Files\nodejs\node.exe' ...` where needed.
- Local development uses PGlite in `.data/pglite` when `DATABASE_URL` is unset. Only one process may access that directory; stop the dev server before a build or database task.
- Production uses Neon. `npm run db:push` applies the Drizzle schema; `npm run db:seed:reference` is insert-only reference data.
- Primary checks: `node node_modules/typescript/bin/tsc --noEmit`, `npm run build`, and `npm run test:e2e`.
- Android requires Java 21 from Android Studio's JBR. `android/app/google-services.json` and `android/keystore.properties` are intentionally ignored.

## Mobile release constraints

- Play release work is parked until Zach confirms Google Play identity verification has cleared.
- A release build still needs a user-created, backed-up Android keystore and Gradle signing configuration. The deployed `assetlinks.json` needs the final Play App Signing SHA-256 before release.
- iOS is blocked on a Mac and Apple Developer account. Sign in with Apple is required before shipping iOS with Google sign-in.

## Working style

- Read `FEATURES-ADDED.md` and `NEXT-STEPS.md` first; these are the only product-status documents to maintain.
- Keep work scoped. Do not revive completed planning documents or begin health/push/mobile-store work without an explicit request.
- Preserve existing user changes and do not reset or revert unrelated work.
