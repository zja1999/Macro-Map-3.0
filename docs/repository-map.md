# Repository map

## Top-level layout

| Path | Responsibility | Change when |
|---|---|---|
| `src/app` | Next.js App Router pages, layouts, loading UI, and API routes | Adding/changing URLs or server-rendered screens |
| `src/actions` | Authenticated server mutations by domain | A form or interaction writes data |
| `src/components` | Reusable and client-interactive UI | UI state, forms, overlays, native bridges |
| `src/lib` | Reads, domain algorithms, auth/permissions, integrations, utilities | Shared behavior or server-side queries |
| `src/db/schema.ts` | All Drizzle tables and JSON document types | Persistent shape or constraints change |
| `src/db/client.ts` | Hosted Postgres vs local PGlite driver selection | Database connection behavior changes |
| `src/middleware.ts` | Coarse public/protected route gate | Anonymous browsing policy changes |
| `scripts/seed.ts` | Reference data and destructive demo fixtures | Seed catalog or demo scenarios change |
| `scripts/make-admin.ts` | CLI role promotion | Admin bootstrap changes |
| `tests/e2e` | Playwright critical journeys | User-visible flows or selectors change |
| `public` | PWA manifest, service worker, icons, App Links metadata | Web install/offline/link assets change |
| `capacitor` | Bundled offline/retry fallback | Remote site cannot load |
| `android` | Native Android project, resources, manifest, Gradle | Native capabilities or store build changes |
| `assets` | Source artwork for generated native/web assets | Icons or splash artwork changes |
| `scratch_sql` | Historical/manual SQL batches, not the schema source | Reference only; do not treat as migrations |
| `docs` | Canonical engineering documentation | Behavior or operational knowledge changes |

## Application layers

| Layer | Typical files | Notes |
|---|---|---|
| Route composition | `src/app/(main)/**/page.tsx` | Server components fetch and compose; protected pages call `requireUser` or role guards themselves |
| Client interaction | `src/components/*Form.tsx`, sheets, scanners | May invoke server actions; do not import server-only database code |
| Write boundary | `src/actions/*.ts` | Validate, authenticate, authorize, transact/update, notify, revalidate |
| Read/domain boundary | `src/lib/queries.ts` and focused libraries | `queries.ts` owns many social/diary/profile reads; restaurant, workout, challenge, group, integration logic is split out |
| Persistence | `src/db/client.ts`, `src/db/schema.ts` | Drizzle with snake-case database columns |

## Domain ownership map

| Domain | Routes | Actions | Main libraries/components |
|---|---|---|---|
| Identity/profile | auth routes, `/onboarding`, `/settings`, `/u/[username]` | `auth.ts`, `account.ts`, `onboarding.ts` | `auth*.ts`, `googleAuth.ts`, `targets.ts`, settings/onboarding forms |
| Nutrition diary | `/track`, `/track/add` | `logging.ts`, `barcode.ts`, `sleep.ts`, `fasting.ts` | `queries.ts`, `nutrients.ts`, fallback foods, diary/log components |
| Recipes | `/recipes/**` | `recipes.ts` | recipe queries, `RecipeForm`, `RecipeCard` |
| Restaurants | `/restaurants/**` | `restaurants.ts` | `restaurants.ts`, map, location bar, bowl builder |
| Planning | `/groceries`, `/meal-prep/**` | `groceries.ts`, `mealPreps.ts` | grocery pages, `MealPrepForm` |
| Fitness/progress | `/workouts/**`, `/progress` | `workouts.ts`, `progress.ts`, `sleep.ts` | `workouts.ts`, progress/workout/habit components |
| Community | `/`, `/discover`, `/posts/**`, profiles | `social.ts`, `notifications.ts` | `queries.ts`, post/reaction/comment components |
| Groups/challenges | `/groups/**`, `/challenges/**` | `groups.ts` | `groups.ts`, `challenges.ts`, member/moderation components |
| Trust/admin | `/admin/**` | `moderation.ts`, `admin.ts`, `imports.ts`, `feedback.ts` | `permissions.ts`, moderation/admin components |
| Integrations/platform | `/settings/integrations`, `/api/integrations/**` | `integrations.ts`, `push.ts` | `lib/integrations/**`, `push.ts`, `native.ts`, `NativeInit` |

## Important cross-cutting files

- `src/app/(main)/layout.tsx`: anonymous/authenticated shell, onboarding redirect, streak/unread/frequents preload, side/tab navigation.
- `src/app/globals.css` and `src/components/ui.tsx`: design tokens and shared UI primitives.
- `src/lib/utils.ts`: dates, meal slots, reaction kinds, recipe tags, labels.
- `src/lib/units.ts`: all metric/imperial conversions and display formatting.
- `src/lib/notify.ts`: in-app notification insertion; push delivery is a separate best-effort layer.
- `next.config.ts`: security response headers and PGlite server package configuration.
- `capacitor.config.ts`: remote URL shell, native user-agent token, offline fallback, splash/keyboard behavior.

Use the [Route catalog](reference/routes.md) and [Server action catalog](reference/server-actions.md) for exact public entry points.
