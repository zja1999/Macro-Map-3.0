# Phase 4 Status — Store MVP (what shipped, what's blocked)

_Written 2026-07-10 at the end of Phase 4. Read alongside `PHASE-4-HANDOFF.md` (the plan) and the
overhaul plan §5/§7. §0 of the handoff still governs: **this is a remote-URL app** — all `src/**`
(web) code only runs in the app **after a Vercel deploy**._

---

## 1. What shipped this phase (all committed)

| Area | State | Verified |
|------|-------|----------|
| **Account deletion** (§3b) | `deleteAccount` action + typed-DELETE confirm Sheet in Settings | Typecheck; logic reviewed. Needs a real deploy to click through. |
| **Push notifications** (§3a) | Full code path, dependency-free FCM v1 sender | Native build green + boots clean; **no end-to-end push** (needs Firebase, see §2). |
| **In-app review** (§3d) | Plugin + rate-limited nudge on streak milestone / workout PR | Native build green. |
| **Verified deep links** (§3e) | `/.well-known/assetlinks.json` with **debug** fingerprint | File served from `public/`; bypasses auth gate (middleware skips dotted paths). |
| **App icon + splash** (§3c) | Branded orange macro-ring on dark, all densities + dark Android-12 system splash | **Verified on API 35 emulator** — icon + dark splash render, app launches to live login, no crash. |

### Code map (new/changed)
- **Account deletion:** `src/actions/account.ts` (FK-safe hard delete), `src/components/DeleteAccountSection.tsx`,
  wired into `src/app/(main)/settings/page.tsx`. The three NOT-NULL, non-cascade FKs to `users`
  (`nutrition_import_batches.uploadedBy`, `challenges.createdBy`, `groups.createdBy`) are cleared first in
  the same transaction; everything else cascades. **Deleting the user also deletes groups they created** —
  intentional MVP behaviour, revisit if group hand-off is added.
- **Push:** `src/db/schema.ts` `deviceTokens` table · `src/actions/push.ts` `registerDeviceToken` ·
  `src/lib/push.ts` FCM HTTP v1 sender (JWT via Node `crypto`, no npm dep) · `src/lib/notify.ts`
  `createNotifications()` = DB insert **+** push fan-out · call sites in `src/actions/social.ts` +
  `src/actions/groups.ts` refactored onto it · token registration in `src/components/NativeInit.tsx`.
- **Review:** `src/lib/review.ts` + `src/components/ReviewNudge.tsx`, triggered from `DashboardHero.tsx`
  (streak % 7) and `workouts/page.tsx` (PR moment).
- **Assets:** source art in `assets/` (regen with `npx @capacitor/assets generate --android`),
  generated into `android/.../res/**`, dark system splash via `res/values-v31/styles.xml` + `res/values/colors.xml`.
- **Deps added:** `@capacitor/push-notifications`, `@capacitor-community/in-app-review`, `@capacitor/assets` (dev).

**Everything degrades gracefully** when unconfigured: no Firebase → push is a silent no-op but the in-app
notification row still writes; plugin missing → the native code is try/caught; DB table not migrated →
missing-table errors are swallowed. So this is safe to deploy *before* the blockers below are resolved.

---

## 2. Blocked on you — do these to light up the remaining features

1. **Deploy `master` + migrate the DB.** Push triggers a Vercel deploy (activates all the Phase 3/4 web
   code). Then run the schema migration against **prod (Neon)** so the new `device_tokens` table exists:
   `npm run db:push` with `DATABASE_URL` pointed at prod (do it when no local dev server holds PGlite).
   Nothing else in this phase needs a migration.

2. **Firebase / FCM (unblocks push end-to-end).**
   - Create a Firebase project → add an **Android app** with package `com.macroverse.app`.
   - Download **`google-services.json`** → place in `android/app/`.
   - Apply the Google Services Gradle plugin (the push plugin already pulls `firebase-messaging`, this just
     wires the json):
     - `android/build.gradle` buildscript deps: `classpath 'com.google.gms:google-services:4.4.2'`
     - bottom of `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`
   - Service account → **Vercel env vars** (Production): `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`,
     `FCM_PRIVATE_KEY` (paste the PEM verbatim; `src/lib/push.ts` restores the `\n`). Never commit these.
   - Then rebuild the app (`npx cap sync android` already done; just `assembleDebug`/run) and test: sign in →
     token registers → trigger a follow/comment → push arrives.

3. **Notification copy & cadence sign-off** (plan risk #6). Current push copy is generic ("MacroVerse" +
   the in-app message). Approve tone before any streak-loss/nagging notifications get added.

4. **Play Console** ($25 one-time). Internal-testing track needs a **signed release AAB** → create a
   release keystore (keep it OUT of git, back up the password). Data Safety form: account/email, health &
   fitness data, device tokens for push; no ad tracking. Privacy-policy URL required.

5. **assetlinks release fingerprint.** `public/.well-known/assetlinks.json` currently carries the **debug**
   signing cert SHA-256. Before release, add the **release** cert fingerprint (and, if using Play App
   Signing, the fingerprint Google shows in Play Console → Setup → App signing). You can list multiple.
   After deploy, verify: `curl https://macroverse.vercel.app/.well-known/assetlinks.json` returns the JSON
   (200, `content-type: application/json`).

6. **iOS — still fully deferred** (no Mac). Push (APNs), Sign in with Apple, TestFlight, App Store privacy
   labels all wait for a Mac + Apple Developer account ($99/yr). The push/review code is written to a
   cross-platform API, so iOS is mostly config when the Mac exists.

---

## 3. Quick reference

- Regenerate icons/splash after a new logo: drop a 1024² `assets/logo.png` (or edit the `assets/*` sources)
  then `npx @capacitor/assets generate --android`.
- Native gate: `cd android && JAVA_HOME=<Studio JBR> ./gradlew assembleDebug` (Java 21, not 23).
- Typecheck gate (the real CI): `node node_modules/typescript/bin/tsc --noEmit`.
- The push sender is dependency-free (no `firebase-admin`); it only needs the three `FCM_*` env vars.
