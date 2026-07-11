# Getting started

## Prerequisites

- Node.js compatible with the repository lockfile (Node 22 is the known local toolchain).
- npm.
- Google Chrome for the configured Playwright suite.
- No external database is required for ordinary local development.
- Android work additionally needs Android Studio, its Java 21 JBR, and the Android SDK.

On the known Windows workstation, Node is installed under `C:\Program Files\nodejs`; use the full executable path if it is not on `PATH`.

## Local setup

```bash
npm install
npm run db:setup
npm run dev
```

Open <http://localhost:3000>. The full seed creates several accounts with password `password123`:

| Account | Purpose |
|---|---|
| `demo@macromap.app` | Primary pre-onboarded demo user |
| `admin@macromap.app` | Admin pages and moderation/import workflows |
| `maria@macromap.app` | Recipe creator used by E2E tests |

The seed output is authoritative if accounts change.

## Local database behavior

When `DATABASE_URL` is absent, `src/db/client.ts` opens embedded PGlite at `.data/pglite`. Drizzle uses the same `src/db/schema.ts` definitions and snake-case mapping in local and hosted environments.

PGlite holds an exclusive lock. Only one app, build, schema tool, seed, or test server may use the directory at once. If a command hangs or reports a lock error:

1. Stop `npm run dev`.
2. Ensure no stale Node process owns port 3000 or `.data/pglite`.
3. Run the database/build command.
4. Restart development afterward.

Do not delete `.data/pglite` unless a clean local database is intentionally desired.

## Database commands

| Command | Effect | Safety |
|---|---|---|
| `npm run db:push` | Push `src/db/schema.ts` into the selected database | Mutates schema |
| `npm run db:seed` | Recreates demo/reference content locally | Destructive to application tables |
| `npm run db:seed:reference` | Insert-only foods, restaurant, exercise, and workout-template bootstrap | Intended for hosted bootstrap; skips non-empty reference tables |
| `npm run db:setup` | Runs schema push, then full demo seed | Local setup only |
| `npm run make-admin -- user@example.com` | Promotes an existing user | Mutates role; requires schema to exist |

`DATABASE_URL` selects hosted Postgres for all database commands. The full demo seed refuses to run against it unless `--force-demo` is explicitly supplied. Never use that override against production without a deliberate data-reset decision.

## Development loop

- Route pages and layouts: `src/app`.
- Interactive UI: `src/components`.
- Mutations: `src/actions`.
- Reads and domain logic: `src/lib`.
- Tables: `src/db/schema.ts`.

Start from the [Route catalog](reference/routes.md), then trace imports into components, actions, and domain libraries. See [Architecture](architecture.md) for the expected boundary pattern.

## Verification loop

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```

Run TypeScript after ordinary code changes. Run the production build after route, server/client boundary, configuration, or dependency changes. Run targeted Playwright tests for changed user flows. See [Testing](testing.md) for database and browser constraints.

## Android live development

The checked-in Capacitor config defaults to the deployed web app. To point the Android shell at a development server reachable on the same network, set `CAP_SERVER_URL` to the workstation LAN address before running or syncing Capacitor, for example `http://192.168.1.20:3000`. Cleartext is enabled automatically for an `http://` override.

See [Platform and integrations](platform-and-integrations.md) before changing native behavior.
