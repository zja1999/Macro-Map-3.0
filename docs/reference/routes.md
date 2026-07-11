# Route catalog

This catalog maps externally reachable Next.js routes to their ownership and access model. Route groups such as `(main)` and `(auth)` do not appear in URLs.

Access labels:

- **Public:** renders without a session.
- **Public browse:** anonymous content page; interactions still authenticate in actions.
- **User:** valid session and normally completed onboarding.
- **Moderator/Admin:** role guard in page/action.

## Authentication and onboarding

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/login` | Public | `src/app/(auth)/login/page.tsx` | Email/password login and Google start link |
| `/register` | Public | `src/app/(auth)/register/page.tsx` | Account/profile creation |
| `/forgot-password` | Public | `src/app/forgot-password/page.tsx` | Generic reset request |
| `/reset-password?token=…` | Public | `src/app/reset-password/page.tsx` | Validate/submit new password |
| `/verify-email?token=…` | Public route handler | `src/app/verify-email/route.ts` | Consume verification token, verify user, create session |
| `/verify-email/sent` | Public | `src/app/verify-email/sent/page.tsx` | Verification instructions/resend form |
| `/privacy` | Public | `src/app/privacy/page.tsx` | Privacy/data-handling policy and user-rights summary |
| `/onboarding` | User | `src/app/onboarding/page.tsx` | Profile/goal/target onboarding wizard |
| `/settings` | User | `src/app/(main)/settings/page.tsx` | Profile, targets, biometrics, account controls |
| `/settings/integrations` | User | `src/app/(main)/settings/integrations/page.tsx` | Provider connection and sync state |

## Main, diary, and progress

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/` | User | `src/app/(main)/page.tsx` | Following/trending feed, composer, daily snapshot |
| `/track?date=YYYY-MM-DD` | User | `src/app/(main)/track/page.tsx` | Diary, macro/micronutrient totals, water, fasting |
| `/track/add` | User | `src/app/(main)/track/add/page.tsx` | Search/frequents/saved/quick/barcode/restaurant logging |
| `/progress` | User | `src/app/(main)/progress/page.tsx` | Measurements/photos/habits/sleep/health dashboard |
| `/progress/habits` | User | `src/app/(main)/progress/habits/page.tsx` | Focused daily habit check-in and habit management |
| `/me` | User | `src/app/(main)/me/page.tsx` | Redirect/entry to current user's profile content |
| `/notifications` | User | `src/app/(main)/notifications/page.tsx` | In-app notification inbox/read actions |

## Recipes, restaurants, and planning

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/recipes` | Public browse | `src/app/(main)/recipes/page.tsx` | Search/filter/sort community recipes and saved view |
| `/recipes/new` | User | `src/app/(main)/recipes/new/page.tsx` | Recipe creation |
| `/recipes/[id]` | Public browse | `src/app/(main)/recipes/[id]/page.tsx` | Recipe detail, ingredients, trust/interactions/logging |
| `/restaurants` | Public browse | `src/app/(main)/restaurants/page.tsx` | Nearby/map/list/filter discovery |
| `/restaurants/[chainId]` | Public browse | `src/app/(main)/restaurants/[chainId]/page.tsx` | Chain menu, builds, popular/personal orders |
| `/restaurants/build/[itemId]` | Public browse | `src/app/(main)/restaurants/build/[itemId]/page.tsx` | Buildable item option UI and logging/saving |
| `/groceries` | User | `src/app/(main)/groceries/page.tsx` | Current grocery list |
| `/meal-prep` | Public browse | `src/app/(main)/meal-prep/page.tsx` | Browse plans and saved plans |
| `/meal-prep/new` | User | `src/app/(main)/meal-prep/new/page.tsx` | Compose plan from recipes |
| `/meal-prep/[id]` | Public browse | `src/app/(main)/meal-prep/[id]/page.tsx` | Plan detail, interactions, grocery expansion |

## Workouts and community discovery

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/workouts` | Public browse | `src/app/(main)/workouts/page.tsx` | Templates/community workouts; user logs/PRs when signed in |
| `/workouts/new` | User | `src/app/(main)/workouts/new/page.tsx` | Create/fork workout definition |
| `/workouts/[id]` | Public browse | `src/app/(main)/workouts/[id]/page.tsx` | Workout detail and interactions |
| `/workouts/log` | User | `src/app/(main)/workouts/log/page.tsx` | Log planned or freeform strength/cardio/mobility session |
| `/discover` | Public browse | `src/app/(main)/discover/page.tsx` | Recipe and people discovery |
| `/posts/[id]` | User via current middleware policy | `src/app/(main)/posts/[id]/page.tsx` | Post detail/comments/reporting |
| `/u/[username]` | User via current middleware policy | `src/app/(main)/u/[username]/page.tsx` | Profile, follow state, posts/content |

`/posts` and `/u` are not in `PUBLIC_PREFIXES`; a logged-out visitor is redirected even though some profile/post content may conceptually be public. Change middleware and page data filtering together if public profiles/posts are desired.

## Groups and challenges

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/groups` | User | `src/app/(main)/groups/page.tsx` | Group discovery, membership, creation |
| `/groups/[slug]` | User | `src/app/(main)/groups/[slug]/page.tsx` | Group feed, members/roles/invites, group challenges |
| `/challenges` | User | `src/app/(main)/challenges/page.tsx` | Global/group challenge discovery and creation entry |
| `/challenges/[id]` | User | `src/app/(main)/challenges/[id]/page.tsx` | Challenge detail, participation/check-in, leaderboard |

## Administration

| URL | Access | Source | Purpose |
|---|---|---|---|
| `/admin` | Moderator | `src/app/(main)/admin/page.tsx` | Staff dashboard and capability links |
| `/admin/reports` | Moderator | `src/app/(main)/admin/reports/page.tsx` | Moderation queue and resolutions |
| `/admin/audit` | Moderator | `src/app/(main)/admin/audit/page.tsx` | Moderation audit log |
| `/admin/users` | Admin | `src/app/(main)/admin/users/page.tsx` | Role, ban, and deletion controls |
| `/admin/imports` | Admin | `src/app/(main)/admin/imports/page.tsx` | Nutrition CSV/XLSX imports and batch history |
| `/admin/templates` | Admin | `src/app/(main)/admin/templates/page.tsx` | Official workout template shelf management |
| `/admin/templates/new` | Admin | `src/app/(main)/admin/templates/new/page.tsx` | Create official template |
| `/admin/templates/[id]/edit` | Admin through reused admin form/page flow | `src/app/(main)/admin/templates/[id]/edit/page.tsx` | Edit official template |

## API routes

| Method/URL | Authentication/verification | Source | Purpose |
|---|---|---|---|
| `GET /api/auth/google/start` | Public; config + state cookie | `src/app/api/auth/google/start/route.ts` | Begin Google OAuth |
| `GET /api/account/export` | Current application session; returns `401` otherwise | `src/app/api/account/export/route.ts` | Download a no-store JSON export of current-user data with secrets excluded |
| `GET /api/auth/google/callback` | State cookie + Google verified identity | `src/app/api/auth/google/callback/route.ts` | Link/create identity and application session |
| `GET /api/integrations/[provider]/callback` | User session + OAuth state | `src/app/api/integrations/[provider]/callback/route.ts` | Exchange provider code and store account |
| `GET /api/integrations/[provider]/webhook` | Provider verification token/query | `src/app/api/integrations/[provider]/webhook/route.ts` | Webhook subscription verification |
| `POST /api/integrations/[provider]/webhook` | Provider-specific configured secret/logic | same | Normalize/apply webhook samples where adapter supports it |
| `POST /api/integrations/mobile/upload` | Current application session | `src/app/api/integrations/mobile/upload/route.ts` | Apply normalized native health samples |

## Layout and middleware behavior

- `src/app/layout.tsx`: metadata, font, toast, PWA registration, native initialization.
- `src/app/(auth)/layout.tsx`: auth-page presentation.
- `src/app/(main)/layout.tsx`: anonymous/auth shell, onboarding redirect, navigation, global log sheet data.
- `src/middleware.ts`: public-prefix and cookie-presence routing. It skips API routes, Next internals, static files, and auth pages.

When adding a route, decide all four layers explicitly: middleware reachability, page-level authentication/role guard, data visibility filtering, and mutation authorization.
