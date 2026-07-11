# Agent operating guide

This file is the mandatory entry point for automated coding agents. The repository is large enough that editing from filenames alone is unsafe.

## Before changing code

1. Read [docs/README.md](docs/README.md) and the documents selected by its task matrix.
2. Check `git status --short`. Existing changes belong to the user unless proved otherwise.
3. Trace the complete read/write path for the feature: route page -> component -> server action -> query/domain helper -> schema.
4. Treat code and configuration as the source of truth. [docs/status-and-roadmap.md](docs/status-and-roadmap.md) records verification state, not a promise that external services are configured.

## Non-negotiable invariants

- Authentication is app-owned. The `mm_session` cookie contains a random token; only its SHA-256 hash is stored. OAuth providers establish identity but do not replace application sessions.
- Middleware is a coarse cookie-presence gate. Every protected page and every mutation must still authenticate and authorize at the server boundary.
- Logged nutrition is a snapshot. Never make historical `food_logs` change when a food, recipe, menu item, or restaurant build changes.
- Canonical measurements are metric in storage. Convert only at input/display boundaries with `src/lib/units.ts`.
- Polymorphic interaction tables (`comments`, `reactions`, `votes`, `saves`, reports/warnings) have no database foreign key to their subject. Actions must validate subject type, existence, visibility, and ownership.
- Role checks are hierarchical (`user < moderator < admin`). Use helpers in `src/lib/permissions.ts`, not exact role comparisons.
- Group authority is separate from global staff authority. Use `src/lib/groups.ts` and the group action rules.
- Third-party health tokens stay server-only and encrypted. Imported samples must remain idempotent through `external_sample_links`; manual sleep/progress data takes precedence over provider data.
- PGlite in `.data/pglite` is single-process. Do not run dev, build, seed, or E2E database access concurrently.
- `npm run db:seed` is destructive demo seeding. Against a hosted `DATABASE_URL`, it is refused unless `--force-demo` is explicitly passed. Production/reference bootstrap uses `npm run db:seed:reference`.
- The Android app is a remote-URL shell. Web changes require a deployment before the installed production shell sees them.

## Task-to-document matrix

| Work | Read first |
|---|---|
| Auth, accounts, profiles, onboarding | [Identity and profiles](docs/domains/identity-and-profiles.md), [Security](docs/security.md) |
| Diary, foods, recipes, restaurants, groceries, meal prep | [Nutrition and planning](docs/domains/nutrition-and-planning.md), [Data model](docs/data-model.md) |
| Progress, habits, workouts, fasting, sleep | [Fitness and health](docs/domains/fitness-and-health.md) |
| Feed, groups, challenges, reports, admin | [Community and trust](docs/domains/community-and-trust.md), [Security](docs/security.md) |
| OAuth health providers, push, PWA, Android | [Platform and integrations](docs/platform-and-integrations.md), [Operations](docs/operations.md) |
| Screen/page work | [Route catalog](docs/reference/routes.md), then the relevant domain guide |
| Server mutation work | [Server action catalog](docs/reference/server-actions.md), [Architecture](docs/architecture.md) |
| Database/schema/seed work | [Data model](docs/data-model.md), [Operations](docs/operations.md) |
| Tests or release verification | [Testing](docs/testing.md), [Operations](docs/operations.md) |

## Expected implementation pattern

- Pages and layouts live in `src/app`; server reads generally come from `src/lib/queries.ts` or a domain library.
- Mutations live in `src/actions`, use `"use server"`, validate untrusted input (normally Zod), authenticate, authorize, write through Drizzle, and revalidate affected routes.
- Interactive UI belongs in `src/components`; keep server-only credentials and database imports out of client components.
- Prefer extending the established domain module over creating a new cross-cutting abstraction.
- Verify in proportion to risk. At minimum run TypeScript after code changes; run build for route/config changes and targeted E2E for user flows.

## Documentation contract

Documentation is part of the change. Update it in the same task when behavior, routes, actions, tables, environment variables, commands, integration readiness, or operational hazards change.

- Keep `docs/README.md` as the navigation hub.
- Put stable behavior in architecture/domain/reference docs.
- Put environment-dependent readiness and remaining work only in `docs/status-and-roadmap.md`.
- Use repo-relative links and exact source paths.
- Do not add chronological handoff files, session logs, duplicated feature lists, or numbered “phase” documents.
- Record “last verified” evidence only when the check actually ran.
