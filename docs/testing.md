# Testing

## Current layers

The repository has four primary executable checks:

| Layer | Command | What it catches |
|---|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | Types, imports, server/client API misuse visible to TS |
| Production build | `npm run build` | Next route compilation, server/client boundaries, static generation/config integration |
| Security policy | `npm run test:security` | Credential-free token and role-hierarchy invariants |
| Media unit | `npm run test:media` | Local storage lifecycle, key generation, image rotation/resizing/WebP conversion, metadata stripping, invalid bytes |
| End to end | `npm run test:e2e` | Critical browser journeys against a seeded database |

The security policy suite uses Node's test runner through `tsx`. Broader pure domain logic is still mostly protected by type/build checks and indirect E2E coverage.

## Playwright configuration

`playwright.config.ts` uses:

- `tests/e2e`;
- installed Chrome (`channel: "chrome"`);
- `http://localhost:3000`;
- one worker, no retries;
- trace retained on failure;
- a development web server that reuses port 3000 if already running.

One worker is intentional: tests share seeded user data and PGlite permits one process. If a dev server is already running, Playwright reuses it; otherwise it starts one. Do not simultaneously run another build/seed/schema command against `.data/pglite`.

## Existing critical journeys

- `log-a-day.spec.ts`: search and log a food, verify diary snapshot, remove it; quick-add snapshot and cleanup.
- `submit-recipe.spec.ts`: create a recipe from linked seeded ingredients and verify calculated provenance/detail page.
- `follow-and-feed.spec.ts`: following feed content, post creation, reaction state, and profile follow rendering.
- `launch-hardening.spec.ts`: public privacy access, unauthenticated export denial, ordinary-user staff-route denial, and authenticated export secret/other-account exclusion.
- `auth-methods.spec.ts`: username/password and Google login/registration surfaces, linked-Google recovery, legacy reset-token consumption, safe Google continuations, and allow-listed callback errors.

Tests use accounts from `tests/e2e/helpers.ts`, currently the primary demo user and Maria recipe creator. Full demo seeding must have run.

## Running tests safely

For a fresh deterministic local run:

```bash
npm run db:setup
npm run test:e2e
```

Run these sequentially. If a dev server is active, stop it before `db:setup`; then either restart it or let Playwright start it. The recipe/post E2E tests create timestamped content and do not fully clean it up, so repeated runs grow local demo data even when diary rows are cleaned.

Run a focused file with Playwright directly, for example:

```bash
npx playwright test tests/e2e/log-a-day.spec.ts
```

The credential-free security checks do not require a database or browser:

```bash
npm run test:security
```

Run the focused authentication browser coverage, stopping its Playwright-managed server before the next PGlite command if the Windows harness remains alive after reporting success:

```powershell
npx playwright test tests/e2e/auth-methods.spec.ts
```

## Change-to-test matrix

| Change | Minimum verification |
|---|---|
| Pure types/text/non-executable docs | Link/content checks; TypeScript if source comments/types changed |
| Server action/query/schema | TypeScript + targeted flow; build for route/data-boundary changes |
| Page/layout/component | TypeScript + build + targeted browser flow |
| Auth/middleware/permissions | TypeScript + build + anonymous, user, moderator, admin negative/positive cases |
| Database schema/seed | Local push/seed + TypeScript + build + affected E2E |
| Next/Capacitor/PWA/security config | Production build + real browser/native smoke test |
| MacroTray web/auth changes | TypeScript + security tests + production build + targeted browser pairing/logging flows |
| MacroTray Rust/config/release changes | `cargo test`, `cargo clippy -- -D warnings`, release Tauri build, and clean Windows installer/updater smoke test |
| Provider integration | TypeScript/build + mocked/controlled normalization tests where added + real sandbox/provider smoke test |

## High-priority missing coverage

- Full mocked/provider coverage for Google callback creation, explicit linking/recovery/reauthentication conflicts, expiry, replay, and session binding.
- Authorization negatives for cross-user IDs, group roles, and public-page actions beyond the covered global hierarchy/page gates.
- Recipe/manual macro paths, restaurant builder constraints, saved-order privacy, and snapshot immutability.
- Workout strength/cardio/mobility/freeform logs and PR extraction.
- Challenge scoring/date boundaries and custom once-per-day check-in.
- Admin import validation/duplicate/error audit.
- Integration normalization, duplicate replay/idempotency, manual precedence, expiry, and reconnect.
- Account deletion cascades and retained/nullified audit rows.
- Offline/PWA and old-native-shell/new-web compatibility.
- MacroTray one-time pairing, separate cookie session, close-to-tray/single-instance/autostart, external browser navigation, offline retry, and signed update behavior.

## Writing robust E2E tests

- Prefer roles, labels, and stable names over CSS class implementation details.
- Use unique test content and clean up when the action supports it.
- Avoid depending on wall-clock meal slot or locale except where explicitly under test.
- Assert both URL/state change and persisted rendered result.
- Add a negative authorization case for any mutation accepting a row ID.
- For exports, recursively assert that sensitive schema keys and another seeded account's identifiers are absent.
- Keep tests serial unless isolation is redesigned around separate database directories/users.

## Recording verification

Do not write “tests pass” into stable feature documentation without a date/commit context. [Status and roadmap](status-and-roadmap.md) contains the current verification record and should say exactly which commands ran and which external smoke tests remain.
