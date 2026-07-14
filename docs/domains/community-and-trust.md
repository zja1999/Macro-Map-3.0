# Community and trust

## Scope and entry points

This domain owns the home/discovery feed, public profiles, follows, posts, reactions, comments, saves/votes shared by content domains, groups, challenges, notifications, reports, moderation, feedback, and admin user/content tools.

- Routes: `/`, `/discover`, `/posts/[id]`, `/u/[username]`, `/groups/**`, `/challenges/**`, `/notifications`, `/admin/**`.
- Actions: `social.ts`, `groups.ts`, `notifications.ts`, `adminNotifications.ts`, `adminBadges.ts`, `moderation.ts`, `admin.ts`, `feedback.ts`.
- Libraries: `queries.ts`, `groups.ts`, `challenges.ts`, `permissions.ts`, `notify.ts`, `push.ts`.

## Feed and interactions

The home feed has following and trending scopes. Group posts are excluded from home feeds and read through the group feed. `posts` can reference a recipe or represent general, tip, question, progress, personal-record, and meal-log content.

Reactions are one row per user/subject with a mutable kind; post cached reaction counts must match row existence. Comments can target posts or recipes and increment post comment counts where applicable. Follow, reaction, comment, and group activity can create in-app notifications; push is best-effort and should not make the underlying mutation fail.

All polymorphic interactions require explicit subject validation. Adding a new subject type means updating allowed unions, existence/visibility checks, counters, detail reads, deletion cleanup, reporting/moderation behavior, and reference documentation.

## Profiles and social graph

Follows are directed and unique. Follow actions prevent invalid/self relationships and notify the target. Follow suggestions contain only unfollowed public users with an actual interaction history with the viewer; comments, reactions, recipe saves/votes, and incoming follows contribute to the ranking, with comments weighted above lightweight engagement. There is no popularity-only fallback. Profile reads combine visibility-safe identity data with follow statistics/state and public content. Banned users and removed/private content must not leak through profile, suggestion, feed, or follow-list queries.

Authenticated username-targeting forms use `GET /api/users/suggest` after two valid username characters. Results are case-insensitive prefix matches ordered by username and expose only the public profile projection needed for the avatar/name/username dropdown. Login, registration, and account-setup username fields deliberately do not use this lookup because they are credential or username-creation surfaces rather than user targeting.

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
- Admin-only pages: user role/ban/delete, notification templates/broadcasts, badge definitions/assignments, nutrition imports, and official workout templates.
- The role hierarchy is capability-based; admins inherit moderator access.
- `canManageUser()` blocks self-management and equal/higher-rank management. Deletion requires a target at role `user`.

Feedback is separate from abuse reports. It records product comments and page context for review/action status.

## Notifications

In-app notifications are durable rows with message/href/read state. The main layout preloads the unread count. Actions can mark individual or all rows read only for the current user. `createNotifications()` accepts one or many inserts and is the central durable-notification helper.

Admins configure the welcome template in `/admin/notifications`. Both password registration and newly created Google accounts receive that template. Admin broadcasts can target one validated username/email, the members of one group, or all non-suspended users; each send records its audience and recipient count in `notification_broadcasts`. Admin- and system-authored notifications may have no profile actor, so inbox reads use a left join and render MacroVerse as the sender fallback.

Avoid trusting freeform notification href/message from client input. Construct them server-side from validated subjects.

## Achievement badges

Badge definitions contain a name, description, customizable emoji or compact uploaded icon, active state, and either manual or automatic award rules. Supported automatic metrics are reputation, authored posts/comments, followers, distinct nutrition logging days, completed workouts, personal records, habit check-ins, and completed challenges. Awards in `user_badges` are persistent snapshots; meeting a milestone inserts an award once and later source-data changes do not revoke it.

The authenticated main layout evaluates active automatic rules for the current user. This catches both new activity and new admin-created badge definitions on the user's next app navigation. Admins can also assign or revoke any badge for an individual username/email. Active earned badges render beside author names on posts, comments, and profile headers; image uploads are client-resized to a compact square data URL before storage.

## Safe change checklist

- Validate polymorphic subjects and visibility before interacting.
- Keep denormalized counts synchronized with row changes.
- Distinguish global role authority from group authority and ownership.
- Record moderation actions and preserve report state transitions.
- Filter removed, banned, private, and group-scoped content in every discovery path.
- Keep notification/push side effects from corrupting the primary transaction.
- Update challenge scoring and leaderboards together when adding metrics.
