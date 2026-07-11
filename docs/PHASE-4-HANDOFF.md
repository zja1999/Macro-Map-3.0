# Phase 4 Handoff — MacroVerse Mobile Overhaul (Store MVP)

_Written 2026-07-10 at the end of Phase 3. Read this top-to-bottom before touching Phase 4._

Full product/design plan: `C:\Users\Zach\.claude\plans\project-macroverse-mobile-overhaul-wondrous-tiger.md`
(Phase table in §5, Phase 4 verification in §7, risks in §6).

---

## 0. The ONE thing to internalize first

**This is a Capacitor _remote-URL_ app.** The native shell's webview loads the **deployed**
site (`https://macroverse.vercel.app`), NOT the local working tree. Concretely:

- What you build **locally** = the native shell + `capacitor.config.ts` + the native project in `android/`.
- All **web/React code** (anything in `src/`) only runs in the app **after it is deployed to Vercel.**
- So the loop for any web-side feature is: edit `src/…` → **push → Vercel deploys** → reinstall/reload the app to see it.
- To test unreleased web code without deploying, point the shell at your dev server:
  `CAP_SERVER_URL=http://<LAN-IP>:3000 npx cap run android` (http auto-enables cleartext; see config).

This bit me in Phase 3: the splash screen hung because I relied on local `SplashScreen.hide()` that
wasn't in the deployed bundle. Fixed by making the splash auto-hide on a timer. **Design every native
feature to degrade gracefully when the remote bundle is older than your local code.**

---

## 1. Current state (what's done)

Phases 0–3 are **committed & pushed to `origin/master`** (Phase 3 = commit `2000689`).

Phase 3 delivered and **verified on an Android emulator** (built → installed → launched → loaded the live
login screen):
- Capacitor 8 (`@capacitor/core|cli|android` + plugins: `haptics`, `status-bar`, `splash-screen`,
  `keyboard`, `app`, `@capacitor-mlkit/barcode-scanning`).
- `capacitor.config.ts` — remote-URL → prod, `CAP_SERVER_URL` override, `appId: com.macroverse.app`,
  `appendUserAgent: "MacroVerseApp"`, dark bg, splash auto-hide (2s), native keyboard resize.
- `src/lib/native.ts` — `isNative()` / `getPlatform()` / `isNativeUA(ua)` (server UA sniff).
- `src/lib/haptic.ts` — `haptic(kind)`: Capacitor Haptics native / `navigator.vibrate` web / no-op.
- `src/components/NativeInit.tsx` (mounted in `src/app/layout.tsx`) — dark status bar, splash hide,
  Android back button, deep-link routing. **All of this is web code → needs a deploy to activate.**
- `BarcodeScanner.tsx` — ML Kit `scan()` on native (Google code scanner, no CAMERA perm) / zxing web,
  same component + manual-entry fallback; success haptic on hit.
- `FoodRow.tsx` quick-add fires a success haptic.
- `android/` — generated project, App Links intent-filter for the domain, `capacitor/www/index.html`
  offline/retry page as `webDir`.

**⚠️ First real action for Phase 4: confirm `master` is deployed on Vercel**, then reinstall the app
(`npx cap run android`) so the Phase 3 web behaviors are actually live. Until then you're testing an
older bundle.

---

## 2. Environment & toolchain (Windows machine, no Mac)

See also memories: `dev-environment-quirks`, `macro-map-mobile-overhaul`, `macro-map-deployment-status`.

- **Node** v24 at `C:\Program Files\nodejs`, NOT on the shell PATH. Prefix every command:
  - PowerShell: `$env:Path = "C:\Program Files\nodejs;$env:Path"; npm ...`
  - Bash: `export PATH="/c/Program Files/nodejs:$PATH"`
  - Typecheck: `node node_modules/typescript/bin/tsc --noEmit` (this is the real CI gate — **no ESLint is configured**).
- **Android builds:** set `JAVA_HOME` to Android Studio's JBR 21, NOT system Java 23 (AGP dislikes 23):
  `export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"`.
- **Android SDK:** `C:/Users/Zach/AppData/Local/Android/Sdk` (`ANDROID_HOME`). cmdline-tools were installed
  during Phase 3 at `.../Sdk/cmdline-tools/latest`. Platform 35 + system image
  `system-images;android-35;google_apis;x86_64` are installed.
- **Emulator already created:** AVD name **`macroverse`** (Pixel 7). Launch:
  `"$ANDROID_HOME/emulator/emulator.exe" -avd macroverse` (background), then `adb install -r <apk>`.
  Or just `npx cap run android` and pick it.
- `android/local.properties` (git-ignored) points Gradle at the SDK.
- **No `gh` / `vercel` CLI.** Git remote `origin` → github.com/zja1999/Macro-Map-3.0; `git push origin master`
  works over HTTPS. Solo master-based workflow (commit straight to master, as prior phases did).
- **Dev DB (PGlite) allows ONE process** on `./.data/pglite`. Don't run `next build`/`npm run db:push`
  while a dev server is up. Vercel prod uses Postgres (Neon), not PGlite.
- **No Mac** → iOS is not buildable here at all. Do all iOS-shaped work as code + config only; the actual
  Xcode build/TestFlight is blocked until a Mac exists.

Handy: `npx cap run android` (build+launch), `npx cap open android` (open in Studio), `npx cap sync android`
(copy web assets + config + plugins into the native project after any config/plugin change).

---

## 3. Phase 4 scope (Store MVP) — concrete pointers

Goal: everything needed to submit to the **Play Store** (Android is the only buildable target here).
iOS items get built as code/config now and finished on a Mac later. Store MVP = Phases 0–4.

### 3a. Push notifications (FCM) — the big one
- Plugin: `@capacitor/push-notifications`. Register for a token in `NativeInit.tsx` (native-only),
  send it to the server.
- **DB:** the app already has a `notifications` table (`src/db/schema.ts:572`) as the source of truth.
  Add a **`device_tokens`** table (userId, token, platform, createdAt, lastSeenAt; unique on token).
  Write a `registerDeviceToken` server action.
- **Sender:** use **FCM HTTP v1** (OAuth2 service-account, server-side — keep the key in a Vercel env var,
  never in the repo/bundle). Add a `src/lib/push.ts` sender.
- **Hook point:** notifications are currently inserted in exactly two places —
  `src/actions/social.ts:20` (batch) and `src/actions/groups.ts:236`. Introduce a single
  `notify()`/`createNotifications()` helper that does the DB insert **and** fans out a push to the user's
  device tokens, then refactor those two call sites to use it. This keeps DB + push in lockstep.
- **CSP:** `next.config.ts` has `connect-src 'self'`. Native push token registration is handled by the
  plugin (not subject to page CSP), and FCM sends are server→Google (no CSP). Only extend `connect-src`
  if you add a **web** push path or client Firebase SDK.
- **Needs the user (blocked):** a **Firebase project** + `google-services.json` placed in
  `android/app/`, and the FCM service-account JSON as a Vercel secret. Flag this early — you can't test
  end-to-end push without it. **APNs/iOS push is deferred** (no Mac / no Apple Developer account yet).
- **Brand call before shipping (plan risk #6):** streak-loss / nagging push tone. Get Zach's sign-off on
  notification copy & cadence.

### 3b. Account deletion in Settings (Apple/Play requirement)
- Settings page: `src/app/(main)/settings/page.tsx`. There is **no account-deletion flow yet**
  (grep only finds group deletion). Add a `deleteAccount` server action that hard-deletes the user
  (schema already uses `onDelete: cascade` on `notifications.userId` etc. — audit ALL FKs to the user
  before trusting cascade). Gate behind a confirm sheet (overlay policy §2 — never `window.confirm`).

### 3c. App icon + splash assets
- Currently the **default blue Capacitor placeholder** icon/splash. Generate branded assets (orange
  `#f97316` on dark `#0a0a0b`) with **`@capacitor/assets`** (point it at a source logo + splash;
  it writes all `mipmap`/`drawable` densities). The splash resource name is already `splash` in config.

### 3d. In-app review prompt
- Add an in-app-review plugin (e.g. `@capawesome/capacitor-app-review`), trigger after a positive moment
  (streak milestone / workout PR). Those events surface around streaks (`getStreak` in `src/lib/queries.ts`)
  and workouts (`src/actions/workouts.ts`). Rate-limit so it never nags.

### 3e. Verified deep links (assetlinks.json)
- The Android manifest already has an `autoVerify` App Links intent-filter for `macroverse.vercel.app`,
  but **verification currently fails** (seen in Phase 3 logcat) because the domain doesn't serve
  `/.well-known/assetlinks.json`. Add that file (served by Next from `public/.well-known/` or a route)
  containing the app's SHA-256 signing-cert fingerprint. Until then, deep links still work as
  user-selectable, just not auto-verified.

### 3f. Store submission
- Play Console (needs Zach's **$25 one-time** developer account): listing copy, screenshots, feature graphic,
  **Data Safety** form (declare: account/email, health & fitness data, device tokens for push; no ad tracking),
  privacy policy URL, internal-testing track build (signed release AAB — set up a keystore, keep it OUT of git).
- iOS/TestFlight, App Store privacy "nutrition labels", and **Sign in with Apple** (plan risk #2 — becomes
  mandatory the moment Google OAuth ships on iOS; Google OAuth was previously reverted, so it's not in yet)
  are all **deferred until a Mac + Apple Developer account ($99/yr)** exist.

---

## 4. Blocked-on-user checklist (raise these first)
1. Confirm Vercel auto-deploys `master` (so Phase 3 web code goes live). If not, help set up the deploy.
2. **Firebase project + `google-services.json` + FCM service-account secret** — required for any push work.
3. Play Console developer account ($25) for release/testing tracks.
4. Notification copy/cadence sign-off (tone risk).
5. Mac + Apple Developer account — gates ALL iOS work; sequence accordingly.

### 4a. 2026-07-10 update — Play release work is parked

Zach started the Play Console path, but Google is currently verifying his identity. Until that clears,
do **not** spend more time trying to finish the store-release track.

What is done locally:
- Neon prod schema was pushed and `device_tokens` exists.
- Firebase Android config was added locally at `android/app/google-services.json` and that file is ignored
  by git.
- Android Google Services Gradle wiring was cleaned up and `assembleDebug` passed, including
  `processDebugGoogleServices`.
- `users.emailVerifiedAt` was added back to `src/db/schema.ts` so Drizzle preserves the existing
  `users.email_verified_at` column in Neon.

Park these until Play identity verification completes:
- Real Android device / Play internal-testing install.
- Release keystore + signed release AAB.
- Play listing, screenshots, Data Safety, and privacy-policy URL.
- Release SHA-256 in `public/.well-known/assetlinks.json` (the file is not present in this checkout yet,
  despite older status notes saying it existed).
- Final end-to-end push test through a store/internal-testing install.

Reasonable next work while waiting: auth hardening from `docs/12-auth-email-google-oauth-plan.md`,
starting with email verification and password reset, then Google OAuth.

### 4b. 2026-07-10 update — auth hardening started while Play is parked

Latest code-only work completed in this checkout:
- Added auth token tables to `src/db/schema.ts`:
  - `email_verification_tokens`
  - `password_reset_tokens`
  - `users.passwordHash` is now nullable so future Google-only accounts can exist without a local password.
- Registration in `src/actions/auth.ts` now creates an unverified account, stores only a SHA-256 hash of
  the email verification token, sends/logs a verification link, and redirects to `/verify-email/sent`.
- Email/password login now handles nullable password hashes and blocks newly-created unverified accounts
  when they have a pending verification token. Legacy users without a token are not stranded.
- Added password reset actions and pages:
  - `/forgot-password`
  - `/reset-password?token=...`
- Added verification route and resend form:
  - `/verify-email?token=...`
  - `/verify-email/sent`
- Added provider-neutral helpers:
  - `src/lib/authTokens.ts`
  - `src/lib/authEmail.ts`
    - In local/dev, this prints verification/reset links to the server console.
    - In production, no real provider is wired yet; pick Resend/Postmark/etc. before expecting email delivery.
- Middleware now keeps `/forgot-password`, `/reset-password`, and `/verify-email` public.

Verification run:
- `& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit` passed.

Important next steps for the next model:
1. Run `npm run db:push` against the intended DB before testing the new auth flow. This adds the new token
   tables and applies the nullable `users.password_hash` change.
2. Start the local dev server and manually test:
   - register -> console verification link -> `/verify-email` -> onboarding
   - unverified login is blocked before verification
   - resend verification logs a new link
   - forgot password -> console reset link -> set new password -> session created
3. Add a real email provider abstraction implementation once Zach chooses one. Until then, production can
   create tokens but will not deliver email.
4. After email verification/password reset is stable, continue `docs/12-auth-email-google-oauth-plan.md`
   with Google OAuth routes and account linking. Store no Google access token unless needed later.

Do not resume Play release work until Zach says Google Play identity verification is cleared.

## 5. Lessons from Phase 3 (don't relearn these)
- Remote-URL runs the **deployed** bundle — deploy before testing native+web features; make native code
  tolerate an older remote (see §0, the splash bug).
- `SplashScreen.launchAutoHide` **must** be `true` (timer cap) — never rely solely on remote JS to hide it.
- The ML Kit **`scan()`** path needs **no CAMERA permission** (Google code scanner). We deliberately do NOT
  declare CAMERA to avoid Play data-safety disclosures. If you switch to the custom-UI `startScan` path
  (needed for iOS — `scan()` is Android-only), you MUST add CAMERA perm + handle permission UX.
- Use **JBR 21** for Gradle (`JAVA_HOME`), not system Java 23.
- After any `capacitor.config.ts` / plugin change: run `npx cap sync android` before rebuilding.
- Verify natively via the emulator + `adb` (screenshot with `adb exec-out screencap -p > file.png`,
  logs with `adb logcat -d`). Browser preview can't exercise native behavior.

## 6. Key files
- `capacitor.config.ts` · `src/lib/native.ts` · `src/lib/haptic.ts` · `src/components/NativeInit.tsx`
- `android/app/src/main/AndroidManifest.xml` (App Links) · `capacitor/www/index.html` (offline page)
- `src/db/schema.ts:572` (notifications) · `src/actions/notifications.ts` · `src/actions/social.ts:20`
  + `src/actions/groups.ts:236` (notification insert sites → wrap with `notify()`)
- `src/app/(main)/settings/page.tsx` (account deletion) · `next.config.ts` (CSP) · `src/lib/queries.ts` (streaks)
