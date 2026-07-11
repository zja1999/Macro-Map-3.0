# MacroVerse

MacroVerse is a full-stack nutrition, fitness, planning, and community application. It runs as a Next.js web/PWA and inside a Capacitor Android shell, with Postgres-compatible persistence through Drizzle.

Production: <https://macroverse.vercel.app>

## Start here

- **New contributor or coding agent:** read [AGENTS.md](AGENTS.md), then use the [documentation portal](docs/README.md).
- **Run the app locally:** follow [Getting started](docs/getting-started.md).
- **Understand the system:** read [Architecture](docs/architecture.md) and [Data model](docs/data-model.md).
- **Find a screen or mutation:** use the [Route catalog](docs/reference/routes.md) and [Server action catalog](docs/reference/server-actions.md).
- **Check what is actually ready:** read [Product status and roadmap](docs/status-and-roadmap.md).

## Quick start

```bash
npm install
npm run db:setup
npm run dev
```

Local development uses PGlite in `.data/pglite`. It permits one process at a time, so stop the development server before running a local build or database command. The full seed creates demo users; the primary login is `demo@macromap.app` / `password123`.

## Verification

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run test:security
npm run build
npm run test:e2e
```

See [Testing](docs/testing.md) before running Playwright or sharing the local database between commands.
