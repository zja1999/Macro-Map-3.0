# Product status and roadmap

This is the only time-sensitive status document. Stable behavior belongs in architecture/domain docs. Update this file when checks, external configuration, blockers, or priorities change.

Last reconstructed from repository code: **2026-07-13**. External production/provider consoles were not inspected during that reconstruction.

## Status vocabulary

- **Implemented:** end-to-end code path exists in the repository.
- **Foundation:** schema/UI/contracts exist, but a required path or external integration remains incomplete.
- **Externally gated:** code may exist, but provider/store/infrastructure configuration or real-world verification is pending.
- **Deferred:** intentionally not a current priority.

## Implemented application surface

- Username/password and Google authentication with app-owned sessions, persistent rate limits, mandatory fallback credentials for Google users, explicit Google recovery linking, reauthenticated password changes, and email-free local registration.
- Anonymous browsing of public recipes, workouts, restaurants, meal-prep plans, and discovery; authenticated interactions.
- Daily macro/micronutrient diary, quick add, water, frequent foods, saved recipes/orders, barcode lookup foundation, fasting, and manual sleep.
- Recipe creation/calculation/provenance, discovery, votes, saves, reviews, comments, feed sharing, and logging snapshots.
- Restaurant map/list/geocoding, nearby/fit filtering, fixed/buildable items, combos, saved go-to orders, and diary logging.
- Grocery lists and recipe/meal-plan expansion; community meal-prep plans.
- Progress measurements, habits/streaks, progress-photo metadata, no-scale presentation, daily health metric display.
- Community/official/freeform workouts across strength/cardio/mobility, logs, PR detection/sharing, votes/saves.
- Feed, posts, reactions, comments, follows, profiles, groups/roles, behavior challenges, configurable welcome/admin notifications, and achievement badges.
- Reports, warnings, audit actions, bans/roles/user admin, nutrition imports, official template admin, and feedback.
- PWA/offline shell and Capacitor Android remote-URL foundation with native initialization, haptics, deep links, scanner/review/push plugin wiring.
- MacroTray Windows quick-logging routes, secure browser pairing, desktop-only signed-download gate, Tauri tray/autostart/updater shell, and draft GitHub release workflow.

“Implemented” here describes repository paths; it does not certify production data migrations, third-party credentials, store readiness, or exhaustive tests.

## Foundation or partial paths

| Area | Present | Incomplete/uncertain |
|---|---|---|
| Progress photos/media | Photo metadata/privacy tables and record action | End-to-end binary upload, durable object storage, transforms, and retrieval are not evident as a complete pipeline |
| Push notifications | Device tokens, FCM sender, Android plugin/Firebase wiring | External Firebase credentials/config and real-device delivery verification are deferred |
| Strava | OAuth, encrypted account, activity backfill, normalization, route storage | Refresh, useful webhook updates, subscriptions, production smoke tests |
| Fitbit | OAuth, step/sleep backfill | Refresh and advertised weight/workout/heart-rate import coverage |
| Apple Health / Health Connect | Provider models and authenticated normalized mobile-upload route | Native device collection/permission bridges and real-device verification |
| Garmin | Data model/descriptor | Approval and provider implementation |
| WHOOP/Oura/Withings | Planned descriptors | Provider implementations |
| Database evolution | Drizzle schema and `db:push` | Versioned migration/expand-contract system |
| Automated tests | Focused username/Google auth E2E, credential-free token/password/role policy tests, plus type/build commands | Mocked/real provider callback setup/link/recovery/reauth integration, cross-user/group mutation negatives, workouts, integrations, deletion, offline/native breadth |

## Current launch-hardening priorities

1. **Verify production authentication.** Preflight duplicate OAuth provider links, apply the current schema, set the canonical app URL and Google credentials, register the exact callback URI, then smoke-test local registration/login, new/existing Google credential setup, explicit linking, recovery, reauthentication, session revocation, safe destinations, bans, denial, state mismatch, and callback/configuration failures.
2. **Verify privacy operations.** Add a real public privacy contact method, review the published `/privacy` text against store data-safety declarations, and smoke-test export/deletion against production data.
3. **Expand critical security tests.** Add auth recovery/replay and cross-user/group mutation negatives before feature breadth.
4. **Establish production observation.** Confirm Vercel/application, hosted database, and relevant provider logs/alerts during initial users.
5. **Choose integration claims deliberately.** Either finish refresh/webhook/native bridges for a provider or keep it labeled experimental/unavailable.

## External gates and deferred work

- Google Play release remains gated on account identity verification and then requires signing, App Links certificate, listing/privacy/data-safety, and device testing.
- MacroTray public download remains gated on Windows Authenticode certificate secrets, Tauri updater key material, a public signed GitHub Release, Rust/Windows build verification, and clean-machine smoke tests. macOS/Linux packages are deferred.
- Push configuration and Firebase real-device verification are deferred until product priority changes.
- iOS requires a Mac, Apple Developer account, native project, and Sign in with Apple if Google sign-in ships there.
- Continuous health/wearable sync is deferred until token refresh, provider normalization breadth, webhook/subscription management, and user-facing controls are complete.

## Verification record

On **2026-07-13**, the username/password and Google-recovery change passed `node node_modules/typescript/bin/tsc --noEmit`, `npm run test:security` (11/11), `npm run db:push` against local PGlite, `npm run build` (58 generated routes/pages), `git diff --check`, and all 5 focused assertions in `tests/e2e/auth-methods.spec.ts`, including a real seeded username login. The Playwright-managed Windows server reported all assertions passed but did not self-exit, so its verified process tree was stopped before later database work. No demo seed command ran. Production schema application, duplicate-OAuth preflight, deployment, Google credentials/callback registration, and real-provider creation/setup/link/recovery/reauthentication smoke tests remain externally gated.

On **2026-07-13**, the MacroTray change passed `npx tsc --noEmit`, `npm run test:security` (7/7), the two focused tests in `tests/e2e/macrotray.spec.ts`, `git diff --check`, `npm run build` (57 static pages), and `npm run db:push` against the local PGlite database while no development server was running. Tauri environment inspection found WebView2, but Rust/Cargo and the Visual Studio C++/Windows SDK toolchain are not installed on this workstation; `npm run tauri:build` stopped at the expected missing `cargo metadata` prerequisite. The native build, signed installer/updater, clean-machine test, and production pairing smoke test therefore remain externally gated.

On **2026-07-12**, the notification/badge change passed `npx tsc --noEmit`, `npm run test:security` (3/3), `git diff --check`, and `npm run build`; the production build generated all 46 static pages including `/admin/notifications` and `/admin/badges`. `npm run db:push` applied the four new local tables while no port-3000 process was using PGlite. Browser flows, production schema application, and external push delivery were not verified.

During the **2026-07-11** launch-hardening sprint:

- `node node_modules/typescript/bin/tsc --noEmit` passed.
- `npm run test:security` passed 3 token/role policy tests without database credentials.
- `npm run build` passed and generated all 41 static pages. The database build-analysis guard prevented PGlite initialization and eliminated the previous post-build `RuntimeError: unreachable`/`Aborted()` warnings.
- `tests/e2e/launch-hardening.spec.ts` passed all 3 browser assertions after `npm run db:push`: public privacy/unauthenticated export, ordinary-user staff-route denial, and authenticated export content/redaction. On this Windows environment Playwright reported all tests passed but its auto-started dev-server harness did not exit before the outer 120-second command timeout; no port-3000 listener remained afterward.
- All relative Markdown document links resolved.
- The route catalog covered every checked-in App Router page/route; the action catalog covered every exported server action; the data model covered all 59 schema tables.
- All documented concrete repository paths resolved except intentionally ignored local secret files such as `android/keystore.properties`.
- No references to the superseded numbered/handoff documentation remained.
- `git diff --check` reported no whitespace errors (only the repository's expected Windows line-ending notices).

The pre-existing feature E2E files were not rerun because they create shared demo content. Production privacy reachability, a public privacy contact method, production export/deletion behavior, auth email delivery, OAuth providers, push, health services, and store consoles were not externally verified.

## How to update this file

- Include a date and exact evidence for checks or external smoke tests.
- Move stable completed behavior into the relevant domain guide; keep only the readiness distinction here.
- Do not mark a provider ready because credentials exist or a settings card renders.
- Do not retain stale “next step” items after completion; replace them with the next concrete risk.
