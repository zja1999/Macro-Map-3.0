# Macro Map — Social Graph, Profiles, Feed, Groups & Challenges

## 1. Social graph design

Two relationship types with different semantics, deliberately kept separate:

| | **Follow** | **Friendship** |
|---|---|---|
| Shape | Asymmetric (A→B) | Symmetric (A↔B), stored once with `user_lo < user_hi` |
| Consent | None needed if target profile is public; follow of private profile = request | Mutual accept required |
| Grants | Target's public content in your feed | Everything follow grants **plus** friends-visibility content (progress check-ins, macro goals, streak comparison), accountability features, DMs (phase 2), close-friend tier |
| Typical use | Creators, coaches, athletes, strangers with your goal | People you actually know / accountability partners |

Rules:
- Friendship **implies** mutual follow (auto-created on accept; unfollow allowed without unfriending — you stay friends but mute their feed presence).
- **Blocks** sever everything both directions (follow rows deleted, friendship set to `blocked`, content mutually invisible, mentions/tags blocked). Mute (client-side preference list) hides without severing.
- **Close friends** is a per-side flag on the friendship — used as an audience option for progress posts.
- Visibility resolution for any resource, in one shared function: `public` → everyone except blocked; `friends` → accepted friends; `private` → owner only. Field-level hide flags then filter the serialized payload ([architecture §7](02-architecture.md)).

### Feed composition
- **Following tab:** posts by followees + groups I'm in, time-ordered (fan-out on read, [architecture §4](02-architecture.md)).
- **Friends tab:** same query restricted to friends; includes friends-visibility posts.
- **Trending tab:** global, from materialized `hot_score` — cold-start safe (works with zero follows).
- Group posts appear in group feed always, home feed if member.
- Anti-spam: per-user post rate limits; new accounts (<7 days or <10 reputation) can post but don't enter Trending.

## 2. Post & interaction model

One `posts` table, 15+ types ([schema](03-database-schema.md)). Structured entities (recipe, workout, prep plan, PR, weigh-in) are **referenced** via `ref_type/ref_id`, never duplicated — the post is the social wrapper; the entity keeps its own votes/saves/ratings. Deleting a post never deletes the entity.

Interactions (all polymorphic): **reactions** (one per user per subject; `like` plus fitness set: strong, clean_meal, high_protein, macro_win, pr, shredded, bulk_fuel, cutting_approved, meal_prep_win, brutal, clean_form, pump, endurance, beginner_friendly), **comments** (one-level threading — deep trees are a Reddit feature this app doesn't need), **saves**, **votes** (recipes/preps/menu items/corrections only — feed posts get reactions, not downvotes, to keep the feed non-hostile), **tags** of users/recipes/workouts/restaurants in post bodies (`@user`, `#recipe:slug` → notification + backlink), **share** (repost-with-comment, phase 2; MVP = copy link), **report**, **block**.

Milestone posts (PR, weigh-in, streak, step goal) are **offered, never auto-published**: the system detects the event and shows a one-tap "share this?" card with an audience picker defaulting to friends.

## 3. User profile design

The profile is the creator's storefront and the friend's accountability page at once.

**Layout** (see [04-screens §19](04-screens.md)): identity header → goal/style chips → badges → counts → content tabs → opt-in modules.

**Always shown (if profile visible):** avatar, display name, username, bio, badges, follower/following counts, published recipes/workouts/preps, public posts.

**Opt-in modules (default off):**
- *Public macro goals* — current targets card ("Cutting on 2,100 kcal / 180 g protein").
- *Transformation timeline* — user-picked photo pairs with dates; requires explicit re-consent per photo (progress photos are private by default and stay in private storage; publishing creates a public copy).
- *PR board* — chosen lifts with best numbers.
- *Location* (city-level string only, never coordinates), *favorite restaurants*, *linked socials*.

**Privacy matrix** (profile-level visibility × field-level flags):

| Field | Default |
|---|---|
| Weight & body measurements | Hidden (friends can see only if flag off AND entry visibility allows) |
| Calories/macro targets | Hidden |
| Progress photos | Hidden, private storage always |
| Location | Hidden |
| Recipes/workouts/posts | Follow profile visibility |
| Logs (food/workout diaries) | Never public; "share posts but not logs" is the default and only mode in MVP — raw diaries are not browsable by others, only shared *highlights* are |

Modes like "share recipes only" / "share workouts only" are implemented as per-content-type visibility defaults, not separate systems.

## 4. Groups

Types (goal/diet/location/gym/interest) are a `kind` + tags, not separate schemas. Public groups: anyone joins; private: request/invite. Roles: owner, moderator, member. Features: group feed (posts with `group_id`), shared recipe/workout collections (saves scoped to group via a group-owned save list — phase 2; MVP = tag-filtered group feed tabs), pinned posts, weekly check-in thread auto-created by cron, group challenges, leaderboard (challenge-derived), group badges. Group mods get remove-post/mute-member powers inside their group only ([07-moderation](07-moderation.md)).

## 5. Challenges

A challenge = metric + target + window (+ optional group). Metrics that auto-score from existing logs (protein-goal days, logged days, workouts/week, steps, fiber days) are preferred — nightly cron updates `challenge_participants.progress`; `custom_checkin` metric covers everything else (self-reported check-in posts). Leaderboards: public (all participants, username + progress) and friends-only slice. Completion → badge + optional certificate image + share-prompt. Anti-toxicity: no weight-loss-amount leaderboards; challenges are behavior-based (adherence, protein, steps, workouts), never "who lost most weight" ([07-moderation §5](07-moderation.md)).

## 6. Accountability features

- **Streaks** (logging, protein, workout, weigh-in) computed nightly; visible to friends when both opt in; streak-comparison chips on Friends screen.
- **Nudges:** friend can send a preset cheer/reminder (rate-limited to 1/day/friend) → notification.
- **Weekly summary** notification: adherence %, protein average, workouts, weight trend, next week's active challenges.
- **Protein consistency comparison** with friends: mutual opt-in, shows % of days hit — never absolute intake numbers.
