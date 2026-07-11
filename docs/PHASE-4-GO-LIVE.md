# Phase 4 — Go-Live Runbook (dummy-proof)

Do these **in order**. Each step says exactly what to click/type and how to know it worked.
Your setup: **Windows**, Node lives at `C:\Program Files\nodejs` (not on PATH), **no `vercel`/`gh`/`firebase`
CLI**, **no Mac**. So everything below uses web dashboards + PowerShell with the Node path prefixed.

**PowerShell prelude** — paste this once at the top of every PowerShell window you use here:
```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
cd "C:\Users\Zach\Claude\Projects\Macro Map 3.0"
```

> ⚠️ **The single most important thing:** the phone app's webview is hard-wired to load
> **`https://macroverse.vercel.app`** (in `capacitor.config.ts`). So in Step 1 your Vercel project
> **must be named exactly `macroverse`** to get that URL. If you name it anything else, the app will
> load the wrong site — see the "Different name?" box in Step 1.

---

## STEP 1 — Put the site online (Neon database + Vercel) and add the new table

The app isn't hosted anywhere yet. This step creates the database, deploys the website, and runs the
one new migration Phase 4 needs (`device_tokens`).

### 1a. Create the database (Neon — free)
1. Go to **neon.tech** → sign up (use your Google login for speed).
2. Click **Create project**. Name: `macroverse`. Region: pick the one nearest you. Click create.
3. On the project dashboard, find **Connection string**. Toggle **Pooled connection** ON (important).
   Copy the string — it looks like:
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
4. Keep this tab open; you'll paste this string twice (here and in Vercel).

### 1b. Load the database schema + starter data (from your PC)
In a PowerShell window with the prelude above, run these **one at a time** (paste your Neon string in
place of `PASTE_NEON_POOLED_URL`):
```powershell
$env:DATABASE_URL = "PASTE_NEON_POOLED_URL"
npm run db:push            # creates every table, including the new device_tokens
npm run db:seed:reference  # loads foods, restaurant menus, exercises, workout templates
```
- `db:push` should end with something like **"Changes applied"** / no errors.
- `db:seed:reference` is insert-only and safe to re-run.
- ✅ **Proof the new table exists:** back in Neon, open **Tables** (or the SQL editor) and confirm you
  see a **`device_tokens`** table alongside `users`, `notifications`, etc.

> After this, **close that PowerShell window** (so `DATABASE_URL` doesn't stick around — you don't want
> your *local* dev server accidentally pointed at the production database).

### 1c. Deploy the website (Vercel)
1. Go to **vercel.com** → sign up **with GitHub** (the account that owns `zja1999/Macro-Map-3.0`).
2. Click **Add New… → Project** → **Import** `zja1999/Macro-Map-3.0`.
3. **Project Name: type `macroverse`** (lowercase). ← this is what makes the URL `macroverse.vercel.app`.
4. Framework: it auto-detects **Next.js**. Leave build settings default.
5. Expand **Environment Variables** and add one now:
   - Name: `DATABASE_URL`  · Value: your Neon **pooled** string · Environments: **Production** (and Preview).
6. Click **Deploy**. Wait ~2–3 min for "Congratulations."
7. ✅ **Proof:** open **https://macroverse.vercel.app** in a browser — you should see the MacroVerse
   login screen (same one the phone app shows). Register an account here to make sure sign-up works.

### 1d. Make yourself an admin (optional but recommended)
In a fresh PowerShell (prelude), after registering your account on the live site:
```powershell
$env:DATABASE_URL = "PASTE_NEON_POOLED_URL"
npm run make-admin -- zja1999@gmail.com
```
Then close the window.

> **Different name?** If Vercel wouldn't let you use `macroverse` (already taken by someone else), pick
> another name, note your real URL (e.g. `macroverse-zja.vercel.app`), then tell me — I'll update the
> three places that hard-code the domain (`capacitor.config.ts`, `AndroidManifest.xml`, and re-sync/rebuild)
> so the app points at your real URL. Don't skip this or the phone app loads the wrong site.

**Step 1 done when:** `https://macroverse.vercel.app` loads the login screen and Neon shows a
`device_tokens` table. Every future `git push origin master` now auto-redeploys the site.

---

## STEP 2 — Turn on push notifications (Firebase / FCM)

Push is fully coded but sleeps until Firebase is wired up. This has three parts: (A) an Android config
file that goes in the project, (B) two one-line Gradle edits, (C) three secrets in Vercel.

### 2a. Create the Firebase project + Android app
1. Go to **console.firebase.google.com** → **Add project** → name `macroverse` → you can **disable**
   Google Analytics (not needed) → Create.
2. On the project home, click the **Android** icon ("Add app").
3. **Android package name:** type **`com.macroverse.app`** exactly (this must match the app).
   Nickname/optional fields can be blank. Click **Register app**.
4. Click **Download `google-services.json`**.
5. Put that file here (exact location): **`android\app\google-services.json`**
   (i.e. `C:\Users\Zach\Claude\Projects\Macro Map 3.0\android\app\google-services.json`).
   > This file is safe to keep out of git; it contains no server secrets. It's fine either way.
6. In the Firebase wizard you can click **Next → Next → Continue to console** (skip the SDK snippets —
   the app already includes them).

### 2b. Two Gradle edits (or let me do them)
These tell Android to read `google-services.json`. **Only do them *after* the file from 2a is in place**
(the build fails if the plugin is applied without the file).
- In **`android\build.gradle`**, inside the existing `buildscript { dependencies { … } }` block, add:
  ```gradle
  classpath 'com.google.gms:google-services:4.4.2'
  ```
- At the very **bottom of `android\app\build.gradle`**, add:
  ```gradle
  apply plugin: 'com.google.gms.google-services'
  ```
> 🟢 Easiest path: once `google-services.json` is in `android\app\`, **tell me "the file is in place"** and
> I'll make these two edits and rebuild the app to confirm it compiles — so you don't touch Gradle at all.

### 2c. The server secret (service account) → Vercel
1. Firebase console → **⚙ Project settings** → **Service accounts** tab → **Generate new private key** →
   confirm → it downloads a JSON file. **Treat this like a password.**
2. Open that JSON in Notepad. You'll use three fields from it.
3. In **Vercel** → your `macroverse` project → **Settings → Environment Variables**, add these three
   (Environment: **Production**):
   | Name | Value (from the service-account JSON) |
   |---|---|
   | `FCM_PROJECT_ID` | the `project_id` value (e.g. `macroverse`) |
   | `FCM_CLIENT_EMAIL` | the `client_email` value (ends in `…iam.gserviceaccount.com`) |
   | `FCM_PRIVATE_KEY` | the **entire** `private_key` value — copy everything **between the quotes**, starting `-----BEGIN PRIVATE KEY-----\n…` and ending `…-----END PRIVATE KEY-----\n`. Keep the `\n` bits exactly as they appear; do **not** add or remove line breaks. |
4. Click **Save**, then go to **Deployments → ⋯ on the latest → Redeploy** (env vars only take effect on a
   new deploy).

### 2d. Rebuild the app and test
The native project already has the push plugin; after 2a/2b rebuild and reinstall:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npx cap run android      # pick the "macroverse" emulator, or a plugged-in phone
```
✅ **Proof push works end-to-end:** sign in on the app → on the live site (or a second account) **follow
that user** or **comment on their post** → a push notification should appear on the device within a few
seconds. (Under the hood: the app registered its token in `device_tokens`, and `notify()` sent via FCM.)

**Step 2 done when:** a real notification lands on the phone. If nothing arrives, check
Vercel → your project → **Logs** for `FCM` errors (usually a mis-pasted `FCM_PRIVATE_KEY`).

---

## STEP 3 — Approve notification copy & cadence (a decision, not code)

Before you ship anything that nags people (streak-reminders, "you broke your streak," re-engagement),
decide the tone so it doesn't feel spammy. Right now the app only sends **event** pushes (someone
followed/commented), titled "MacroVerse" with the in-app message — those are fine and need no copy work.

Decide and write down:
- **Do we send streak/re-engagement reminders at all for launch?** (Recommendation: **no** for v1 — only
  the event pushes above. Add reminders later once you can measure.)
- If yes: **what time of day**, **how often max** (e.g. at most 1/day), and **the exact wording**. Keep it
  encouraging, never guilt-trippy ("Ready to log lunch?" not "You're about to lose your streak!").
- **Quiet hours** (e.g. no pushes 9pm–8am local).

**Step 3 done when:** you've written the answer somewhere (even a sentence in this file). There's nothing
to build for launch if you go with "event pushes only."

---

## STEP 4 — Publish to the Google Play Store

This is the longest step. Budget an afternoon. You need a **$25 one-time** Google account and a **signing
key** you must never lose.

### 4a. Create your Play developer account
1. Go to **play.google.com/console** → sign up → pay the **$25 one-time** fee → finish identity
   verification (Google may take a day or two to verify — start this early).

### 4b. Make a signing key (keystore) — do this once, back it up forever
In PowerShell (prelude), run this and answer the prompts (name, org, etc.). **Pick a password you'll
never lose** and use the same one for both prompts:
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -keystore "$env:USERPROFILE\macroverse-release.jks" `
  -alias macroverse -keyalg RSA -keysize 2048 -validity 10000
```
- This creates **`C:\Users\Zach\macroverse-release.jks`**.
- 🔒 **Back this file up** (password manager + a cloud drive) and **never commit it to git**. If you lose
  it, you can never update the app again under the same listing.

Tell Gradle how to sign with it — create **`android\keystore.properties`** (this file is git-ignored;
never commit it):
```properties
storeFile=C:/Users/Zach/macroverse-release.jks
storePassword=YOUR_PASSWORD
keyAlias=macroverse
keyPassword=YOUR_PASSWORD
```
> 🟢 Wiring this keystore into `android\app\build.gradle`'s `signingConfigs`/`release` block is a fiddly
> ~10-line edit. **Tell me when `keystore.properties` exists and I'll make that edit** and produce the
> signed release file for you (Step 4c).

### 4c. Build the release bundle (AAB)
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd "C:\Users\Zach\Claude\Projects\Macro Map 3.0\android"
.\gradlew bundleRelease
```
The file to upload appears at:
**`android\app\build\outputs\bundle\release\app-release.aab`**

### 4d. Create the store listing + upload
In Play Console → **Create app**:
- App name **MacroVerse**, language, **App** (not game), **Free**.
- Left menu, work top-to-bottom through the tasks it lists. The ones that trip people up:
  - **Privacy policy:** you must host a URL. Simplest: add a `/privacy` page to the site (I can generate
    one), then paste `https://macroverse.vercel.app/privacy`.
  - **Data safety form:** declare what the app collects. For MacroVerse tick: **account info (email)**,
    **health & fitness** data, and **device identifiers** (the push token). **No** advertising/tracking.
    Data is encrypted in transit; users can request deletion (point them to Settings → Delete account).
  - **Store listing assets:** short description, full description, a **512×512 icon**, a **1024×500 feature
    graphic**, and **at least 2 phone screenshots** (grab them from the emulator with
    `adb exec-out screencap -p > shot.png`). I can generate the icon/feature-graphic if you want.
- **Release → Testing → Internal testing → Create release** → upload `app-release.aab` → add your own
  email as a tester → **Save → Review → Roll out**. Install via the tester opt-in link on your phone.

✅ **Proof:** the internal-testing link installs MacroVerse on your phone and it opens to the live login.

### 4e. Turn on verified deep links (assetlinks release fingerprint)
Right now `public/.well-known/assetlinks.json` has the **debug** key's fingerprint. For the store build you
must add the **release** fingerprint so `macroverse.vercel.app` links open the app automatically.
1. Get the release fingerprint. **If you used Play App Signing** (the default — recommended), the correct
   one is in **Play Console → your app → Setup → App signing → "App signing key certificate" → SHA-256**.
   (If you opted out and sign locally, instead run:
   `& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\macroverse-release.jks" -alias macroverse` and read the SHA-256.)
2. Send me that SHA-256 and I'll add it to `assetlinks.json` (keeping debug too), or add it yourself as a
   second entry in the `sha256_cert_fingerprints` array. Commit + push (auto-deploys).
3. ✅ **Proof:** after deploy, visit `https://macroverse.vercel.app/.well-known/assetlinks.json` in a
   browser — it returns the JSON with your release fingerprint. Tapping a macroverse.vercel.app link on
   the phone then opens the app instead of Chrome.

**Step 4 done when:** the app is live on the internal-testing track and assetlinks serves the release
fingerprint.

---

## STEP 5 — iOS (blocked until you have a Mac — here's the readiness list)

Nothing here is doable on Windows. When you get a **Mac + Apple Developer account ($99/yr)**, the work is:
1. On the Mac: `npx cap add ios`, then `npx cap sync ios`. The push/review/deletion code is already
   cross-platform, so most of it "just works."
2. **APNs push:** in the Apple Developer portal create an APNs key, upload it to the **same Firebase
   project** (Firebase → Project settings → Cloud Messaging → Apple app config). Then iOS uses the exact
   same `notify()`/FCM path — no server changes.
3. **Sign in with Apple:** becomes **mandatory** if/when Google sign-in ships on iOS (Google OAuth was
   reverted, so it's not in yet — see `docs/09-deployment.md §3`). Plan for it before an iOS release.
4. **App Store Connect:** privacy "nutrition labels" (same disclosures as Play's Data Safety), screenshots,
   TestFlight for testing, then submit.
5. Deep links on iOS use **`apple-app-site-association`** (the iOS cousin of `assetlinks.json`) served from
   `public/.well-known/` — I'll add it when the iOS app + Team ID exist.

**Step 5 done when:** you have a Mac. Until then it's correctly parked.

---

## Quick "who does what"
- **You (dashboards/accounts):** Neon signup, Vercel signup + project name `macroverse`, Firebase project +
  `google-services.json` + service-account key, Vercel env vars, Play Console $25 + listing + Data Safety,
  keystore creation + backup.
- **Me (code/edits, just ask):** the two Gradle edits for Firebase, the keystore signing-config edit, the
  release AAB build, a `/privacy` page, store icon/feature-graphic, adding the release fingerprint to
  `assetlinks.json`, and pointing the app at a different URL if your Vercel name isn't `macroverse`.
```
