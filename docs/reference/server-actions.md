# Server action and module catalog

This catalog maps mutations to files. It is a navigation aid, not a substitute for reading validation and authorization in the current implementation.

## Account and authentication

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/auth.ts` | `register`, `login`, `logout`, `resendVerification`, `requestPasswordReset`, `resetPassword` | Password identity, hashed email tokens, rate limiting, session creation/destruction |
| `src/actions/account.ts` | `deleteAccount` | Confirmed current-user deletion and logout/redirect lifecycle |
| `src/actions/onboarding.ts` | `completeOnboarding`, `updateTargets`, `updateBiometrics`, `updateProfile`, `updateAvatar` | Profile/onboarding settings and target revisions |

Auth/session helpers: `src/lib/auth.ts`, `authTokens.ts`, `authEmail.ts`, `googleAuth.ts`, `rateLimit.ts`, `targets.ts`, `units.ts`.

## Diary and health habits

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/logging.ts` | `logFood`, `logRecipe`, `quickAdd`, `deleteLogQuiet`, `restoreLog`, `deleteLog`, `copyPreviousDay`, `addWater` | Snapshot logging, undo, day copy, water aggregate |
| `src/actions/barcode.ts` | `lookupBarcode` | Normalize/resolve barcode nutrition lookup |
| `src/actions/fasting.ts` | `startFast`, `endFast`, `discardFast` | Current-user fasting-window lifecycle |
| `src/actions/sleep.ts` | `logSleep`, `deleteSleepLog` | Manual sleep upsert/delete by wake date |
| `src/actions/progress.ts` | `saveProgressEntry`, `toggleHabit`, `addHabit`, `updateHabit`, `archiveHabit`, `ensureDefaultHabits` | Measurements and habit ownership/completion; photo mutations use the authenticated API routes in the route catalog |

Main reads: diary/progress functions in `src/lib/queries.ts`; nutrient and unit logic in `nutrients.ts` and `units.ts`.

## Recipes, restaurants, and planning

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/recipes.ts` | `submitRecipe`, `voteRecipe`, `toggleSaveRecipe`, `reviewRecipe` | Recipe create/update calculation, interactions, aggregate counters |
| `src/actions/restaurants.ts` | `logMenuItem`, `logBuild`, `logGoToOrder`, `deleteGoToOrder`, `toggleRestaurantSave` | Fixed/build logging, saved order lifecycle, restaurant saves |
| `src/actions/groceries.ts` | `addGroceryItem`, `toggleGroceryItem`, `deleteGroceryItem`, `clearPurchased`, `addRecipeToGroceries`, `addPlanToGroceries` | User list and recipe/plan expansion |
| `src/actions/mealPreps.ts` | `createMealPrepPlan`, `votePlan`, `toggleSavePlan` | Plan derivation and interactions |
| `src/actions/imports.ts` | `importNutritionFile`, `importNutritionCsv` (alias) | Admin CSV/XLSX validation, insert, duplicate/error audit |

Main reads/logic: recipe functions in `src/lib/queries.ts`; restaurant math/query functions in `src/lib/restaurants.ts`; file parsing in `src/lib/tabularFiles.ts`.

## Workouts

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/workouts.ts` | `createWorkout`, `saveOfficialTemplate`, `deleteOfficialTemplate`, `logWorkout`, `sharePr`, `voteWorkout`, `toggleSaveWorkout` | Workout/template definitions, typed logs, PRs/sharing, interactions |

`src/lib/workouts.ts` owns activity formatting, planned/log summaries, Epley/volume/rep calculations, PR detection, and workout/exercise/log reads.

## Social, groups, and challenges

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/social.ts` | `toggleFollow`, `createPost`, `shareRecipeToFeed`, `deletePost`, `toggleReaction`, `addComment` | Social graph, feed posts, polymorphic reactions/comments and notifications |
| `src/actions/groups.ts` | `createGroup`, `toggleGroupMembership`, `transferGroupOwnership`, `moderateGroupPost`, `inviteGroupMember`, `removeGroupMember`, `setGroupMemberRole`, `createChallenge`, `joinChallenge`, `leaveChallenge`, `checkinChallenge` | Group lifecycle/authority and challenge participation |
| `src/actions/notifications.ts` | `markNotificationRead`, `markAllNotificationsRead` | Current-user inbox state |

Main reads/logic: feed/profile/comments in `src/lib/queries.ts`; group authority in `src/lib/groups.ts`; metrics and leaderboards in `src/lib/challenges.ts`; durable notification insertion in `src/lib/notify.ts`.

## Moderation and administration

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/moderation.ts` | `submitReport`, `resolveReport`, `moderateContent`, `deleteGroup`, `deleteChallenge` | Reports, warnings/removal/restoration, staff audit, destructive staff operations |
| `src/actions/admin.ts` | `setUserRole`, `banUser`, `unbanUser`, `deleteUser` | Hierarchical user administration |
| `src/actions/feedback.ts` | `submitFeedback` | Product feedback and page context |

Permission helpers: `src/lib/permissions.ts` for global roles; `src/lib/groups.ts` for local/global group authority.

## Integrations and push

| File | Exported mutations | Responsibility |
|---|---|---|
| `src/actions/integrations.ts` | `connectIntegration`, `disconnectIntegrationAction`, `syncIntegrationAction` | OAuth state/redirect, account ownership, manual sync/disconnect |
| `src/actions/push.ts` | `registerDeviceToken` | Current installation token upsert |

Integration libraries:

- `src/lib/integrations/types.ts`: provider and normalized sample contracts.
- `src/lib/integrations/providers.ts`: provider descriptors, OAuth exchange, available backfills/normalizers.
- `src/lib/integrations/crypto.ts`: AES-GCM token encryption.
- `src/lib/integrations/sync.ts`: accounts, sync runs, idempotency, precedence, persistence.
- `src/lib/push.ts`: FCM service-account auth and delivery.

## Read/query module index

| Module | Major exports |
|---|---|
| `src/lib/queries.ts` | feed/user/group posts, reaction summaries, recipe lists/saves/interactions, day/week diary, fasting/sleep/health, streaks/remaining macros/frequents, progress/photos/habits, profiles/follows, notifications, comments, suggestions |
| `src/lib/restaurants.ts` | geocode, nearby locations, fit score/label, option builds, around-me results, chain/menu/orders/saves |
| `src/lib/workouts.ts` | formatting/summaries, PR math/detection, workout lists/details/saves/logs/PRs |
| `src/lib/challenges.ts` | metric definitions, leaderboard computation, challenge lists |
| `src/lib/groups.ts` | group role and combined authority |
| `src/lib/targets.ts` | target calculation and calorie floor |
| `src/lib/nutrients.ts` | nutrient definitions, snapshot scaling, totals |
| `src/lib/units.ts` | canonical metric/imperial conversions and formatting |
| `src/lib/utils.ts` | calendar helpers, meal slots, UI labels/tags/reactions |

## Adding or changing a server action

1. Keep `"use server"` and server-only imports in the action module.
2. Parse untrusted input and bound strings/numbers/arrays.
3. Authenticate; then authorize the target, not only the route that renders the form.
4. Preserve domain invariants from [AGENTS.md](../../AGENTS.md).
5. Use transactions for coupled rows/counters where partial failure is harmful.
6. Revalidate all affected list/detail/profile/dashboard routes.
7. Construct notifications/hrefs server-side and keep push best-effort.
8. Add negative authorization and user-flow tests.
9. Update this catalog if exports or ownership move.
