# MacroVerse

MacroVerse is a community-driven macro tracking, recipe, restaurant, meal-prep, and workout platform. It is live at https://macroverse.vercel.app.

Current product state and engineering context are intentionally kept in three documents:

- [Features Added](docs/FEATURES-ADDED.md): the implemented product surface.
- [Next Steps](docs/NEXT-STEPS.md): the small, prioritized list of remaining work and external blockers.
- [Agent Handoff](docs/AGENT-HANDOFF.md): technical context and operating constraints for future development work.

## Run locally

```bash
npm install
npm run db:setup
npm run dev
```

The local database is PGlite in `./.data/pglite`. It is gitignored and supports one process at a time. Stop the dev server before running a build or database command against the local database.

Demo login: `demo@macromap.app` / `password123`.

## Production

Set `DATABASE_URL` to the hosted Postgres connection string, then run:

```bash
npm run db:push
npm run db:seed:reference
```

`db:seed:reference` is insert-only and loads foods, restaurant menus, exercises, and workout templates without adding demo accounts.

## Verification

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```
