# Community and trust

## Scope and entry points

This domain owns the home/discovery feed, public profiles, follows, posts, reactions, comments, saves/votes shared by content domains, groups, challenges, notifications, reports, moderation, feedback, and admin user/content tools.

- Routes: `/`, `/discover`, `/posts/[id]`, `/u/[username]`, `/groups/**`, `/challenges/**`, `/notifications`, `/admin/**`.
- Actions: `social.ts`, `groups.ts`, `notifications.ts`, `moderation.ts`, `admin.ts`, `feedback.ts`.
- Libraries: `queries.ts`, `groups.ts`, `challenges.ts`, `permissions.ts`, `notify.ts`, `push.ts`.

## Feed and interactions

The home feed has following and trending scopes. Group posts are excluded from home feeds and read through the group feed. `posts` can reference a recipe or represent general, tip, question, progress, personal-record, and meal-log content.

Reactions are one row per user/subject with a mutable kind; post cached reaction counts must match row existence. Comments can target posts or recipes and increment post comment counts where applicable. Follow, reaction, comment, and group activity can create in-app notifications; push is best-effort and should not make the underlying mutation fail.

All polymorphic interactions require explicit subject validation. Adding a new subject type means updating allowed unions, existence/visibility checks, counters, detail reads, deletion cleanup, reporting/moderation behavior, and reference documentation.

## Profiles and social graph

Follows are directed and unique. Follow actions prevent invalid/self relationships and notify the target. Profile reads combine visibility-safe identity data with follow statistics/state and public content. Banned users and removed/private content must not leak through profile, suggestion, feed, or follow-list queries.

## Groups

Groups have unique slugs, a cached member count, and local roles:

- member: participate and post;
- moderator: manage ordinary group content/members within rule limits;
- owner: manage moderators and transfer ownership.

Global moderators/admins can receive group authority through `getGroupAuthority()`, but ownership-specific actions remain stricter. The owner cannot simply be removed or demoted; ownership must be transferred to an existing member. Member-count changes must stay consistent with membership rows.

Group posts use `posts.group_id`. Group moderation can remove/restore a post and records an audited moderation action. Invitations are username-based and follow the action's membership/authority checks.

## Challenges

Challenges may be global or attached to a group and are intentionally behavior-based. Supported metrics are defined in `src/lib/challenges.ts` and include logged days, protein-target days, workouts, and custom daily check-in.

Auto-scored leaderboards compute progress from existing diary/workout data within the challenge window. Custom check-in writes participant progress at most once per day. Enrollment is one participant row per user/challenge; completion timestamps depend on reaching target. Keep date-window filtering consistent and do not introduce weight-loss-amount competitions.

## Reports and moderation

Users can report supported subjects with controlled reason values and optional detail. Moderators/admins review an open queue and can dismiss, remove/restore content, or add warning labels. Every moderation result should create a `moderation_actions` audit row and update report status/reviewer/time as relevant.

Content removal behavior differs by subject table; posts have an explicit `is_removed`, while recipes/workouts/plans use status. New moderation paths must preserve author notice behavior and keep removed content out of feeds/search/public profiles.

Warning labels are polymorphic and allow multiple kinds per subject. They provide context without deleting the subject.

## Global administration

- Moderator pages: dashboard, report queue, audit log.
- Admin-only pages: user role/ban/delete, nutrition imports, official workout templates.
- The role hierarchy is capability-based; admins inherit moderator access.
- `canManageUser()` blocks self-management and equal/higher-rank management. Deletion requires a target at role `user`.

Feedback is separate from abuse reports. It records product comments and page context for review/action status.

## Notifications

In-app notifications are durable rows with message/href/read state. The main layout preloads the unread count. Actions can mark individual or all rows read only for the current user. `createNotifications()` accepts one or many inserts and is the central durable-notification helper.

Avoid trusting freeform notification href/message from client input. Construct them server-side from validated subjects.

## Safe change checklist

- Validate polymorphic subjects and visibility before interacting.
- Keep denormalized counts synchronized with row changes.
- Distinguish global role authority from group authority and ownership.
- Record moderation actions and preserve report state transitions.
- Filter removed, banned, private, and group-scoped content in every discovery path.
- Keep notification/push side effects from corrupting the primary transaction.
- Update challenge scoring and leaderboards together when adding metrics.
