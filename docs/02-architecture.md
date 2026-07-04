# Macro Map — Technical Architecture

## 1. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for SSR feed pages, API routes, and admin; mobile-first responsive; huge ecosystem |
| Database | **PostgreSQL 16** | Relational requirement; strong indexing for feed/ranking queries; `pg_trgm` for search; JSONB where flexibility helps |
| ORM | **Drizzle ORM** | SQL-first (ranking queries need real SQL), typed schema doubles as documentation, cheap migrations |
| Auth | **Auth.js (NextAuth v5)** with email/password + OAuth (Google, Apple) | Boring, well-trodden; sessions in Postgres |
| Validation | **Zod** | Shared schemas between forms, API, and DB boundaries |
| UI | **Tailwind CSS + shadcn/ui** | Fast, consistent, reusable components; mobile-first by default |
| Media | **Cloudflare R2** (S3-compatible) + presigned uploads; `sharp` for server-side resize/strip-EXIF | Cheap egress for image-heavy feeds; EXIF stripping matters for progress-photo privacy |
| Cache/queues | **None in MVP.** Postgres does everything. Add **Redis** (feed cache, rate limits) + a job runner (pg-boss → BullMQ) when metrics demand it | Biggest simplicity lever; see §6 |
| Search | Postgres full-text + `pg_trgm` | Dedicated search engine (Typesense/Meilisearch) is roadmap, not MVP |
| Barcode data | **Open Food Facts** dump imported into `foods` + user submissions | Free, open, importable offline |
| Nutrition base data | **USDA FoodData Central** import | Ingredient-level macro calculation needs a canonical ingredient DB |
| Hosting | Vercel or Railway (app) + Neon/Supabase-Postgres or Railway (DB) + R2 (media) | Zero-ops start; nothing vendor-locked |
| Testing | Vitest (unit) + Playwright (e2e critical flows) | Log-a-day and submit-a-recipe flows must never break |

**Explicitly rejected for MVP:** microservices, GraphQL, Kubernetes, ElasticSearch, event buses, separate API service, React Native. All are re-addable later because of the layering below.

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────┐
│  Next.js app (single deployable)                       │
│                                                        │
│  app/ (routes, RSC pages, layouts)                     │
│   ├─ Server Components ──► services (read paths)       │
│   ├─ Server Actions ─────► services (simple mutations) │
│   └─ app/api/v1/* ───────► services (versioned REST)   │
│                                                        │
│  src/services/  ← ALL business logic lives here        │
│  src/db/        ← Drizzle schema + query helpers       │
└──────────┬───────────────────────────┬─────────────────┘
           │                           │
      PostgreSQL                  Cloudflare R2
   (data + jobs + search)         (images/video)
```

**The one load-bearing rule:** UI (pages, server actions, API routes) never touches the DB directly. Everything goes through `src/services/*`. Server Actions and `/api/v1` are thin adapters over the same service functions. That's what makes the app "API-ready for future mobile" without building a separate API now — when a native app arrives, `/api/v1` already exposes every capability because it shares the service layer.

## 3. API design

- **REST, versioned at `/api/v1`**, JSON, cursor pagination everywhere (`?cursor=<opaque>&limit=20`). No offset pagination on any feed.
- Auth via session cookie (web) — the same endpoints accept a bearer token later for mobile.
- Errors: `{ error: { code, message, field? } }` with stable machine codes.
- Rate limiting per user+route class (writes tighter than reads), enforced in middleware backed by a Postgres counter table (Redis later).

Representative resources (all backed by services):

```
POST   /api/v1/auth/*                      (Auth.js)
GET    /api/v1/feed?scope=following|friends|group:<id>|trending
GET    /api/v1/posts/:id · POST /api/v1/posts · POST /api/v1/posts/:id/reactions
GET    /api/v1/recipes?filters… · POST /api/v1/recipes
POST   /api/v1/recipes/:id/vote|save|try|rate|fork|corrections
GET    /api/v1/recipes/:id/versions
GET    /api/v1/foods/search?q= · GET /api/v1/foods/barcode/:ean
GET    /api/v1/logs/day/:date · POST /api/v1/logs · POST /api/v1/logs/copy
GET    /api/v1/restaurants?near=lat,lng · GET /api/v1/chains/:id/menu-items?sort=protein_ratio
POST   /api/v1/menu-items · POST /api/v1/menu-items/:id/rate
GET    /api/v1/workouts?filters… · POST /api/v1/workouts · POST /api/v1/workouts/:id/complete
POST   /api/v1/workout-logs
GET/POST /api/v1/users/:username/follow · /api/v1/friendships
GET    /api/v1/groups · POST /api/v1/groups/:id/join
GET    /api/v1/challenges · POST /api/v1/challenges/:id/join
GET/POST /api/v1/progress · GET /api/v1/progress/analytics
GET/POST /api/v1/grocery-lists · POST /api/v1/grocery-lists/:id/items:from-recipe
POST   /api/v1/reports · GET /api/v1/admin/* (role-gated)
GET    /api/v1/notifications · POST /api/v1/notifications/read
POST   /api/v1/media/presign
```

## 4. Feed architecture (the performance-critical path)

**MVP: fan-out on read.** A user's home feed is a single indexed query:

```sql
SELECT p.* FROM posts p
WHERE (p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $me)
    OR p.group_id  IN (SELECT group_id FROM group_members WHERE user_id = $me))
  AND p.visibility_ok($me)          -- computed via joins, see 03-database-schema
  AND p.created_at < $cursor
ORDER BY p.created_at DESC LIMIT 20;
```

With `posts(author_id, created_at DESC)` and `posts(group_id, created_at DESC)` indexes this holds comfortably to hundreds of thousands of users, because follow graphs are small at that scale. **Trending** is not computed per-request: a scheduled job (Vercel cron / pg_cron, every 10 min) refreshes a `trending_scores` materialized view using the hot-ranking formula in [06-recipes §8](06-recipes-voting-reputation.md). Counters (votes, saves, comments) are denormalized columns on the parent row, updated in the same transaction as the interaction insert — never `COUNT(*)` at read time.

**Later (only if p95 feed latency demands):** Redis cache of first feed page per user → fan-out-on-write mailbox table for high-follower creators (hybrid push/pull). The read query above stays as the fallback, so this is additive, not a rewrite.

## 5. Media pipeline

1. Client requests `POST /media/presign` with content-type + purpose (`recipe`, `progress`, `avatar`, `post`).
2. Server validates (size caps, type allowlist), returns presigned R2 PUT URL + a pending `photos` row.
3. Client uploads directly to R2 (app servers never proxy bytes).
4. On confirm, a processing step (inline in MVP, job later) generates thumbnail/feed/full variants via `sharp`, **strips EXIF/GPS always**, marks the row `ready`.
5. Progress photos additionally get `private` storage class — served only through short-lived signed GETs, never public CDN URLs, regardless of post visibility.

## 6. Async work

MVP runs on cron + transactional side effects only:

| Job | Mechanism |
|---|---|
| Trending/materialized rankings | cron every 10 min |
| Daily streak evaluation + reminder notifications | cron nightly per timezone bucket |
| Weekly progress summary | cron weekly |
| Reputation recompute (incremental) | trigger-ish: event rows inserted transactionally, aggregated by cron every 5 min |
| Media variants | inline at upload confirm (move to queue when slow) |
| Nutrition CSV/PDF imports | admin-triggered background task (long-running route → later job runner) |

Notifications are **rows first** (`notifications` table renders the in-app inbox); push/email delivery is a roadmap consumer of the same rows. Batching rule: per-user, per-category, max 1 push per hour, digestible categories collapse ("3 people saved your recipe").

## 7. Security & privacy

- All visibility checks in the service layer, one shared `canView(viewer, resource)` module — never in components. Per-field privacy flags (hide weight/calories/photos/location/measurements) are applied at serialization time by a single `serializeProfile(viewer, user)`; there is exactly one place that decides what leaks.
- Progress photos: private storage + signed URLs (see §5). Weight and body measurements are `friends`-visible at most by default; public requires explicit opt-in per field.
- Standard hygiene: parameterized queries only (ORM), CSRF via same-site cookies + origin checks on mutations, upload type/size validation, per-route rate limits, admin routes behind role middleware + audit log (`moderation_actions`).
- ED-sensitive guardrails enforced server-side: calorie targets floor at 1,200 (configurable clinically-informed constant), no-scale mode suppresses weight prompts everywhere, weight/body-fat fields never appear in public serializations unless opted in.
- GDPR-shaped from day one: user data export endpoint, hard-delete cascade path, media deletion fanout.

## 8. Search, filtering, tagging

- `tags` is a first-class table shared by recipes, workouts, meal preps, posts (polymorphic `taggings`). Filters compile to indexed WHERE clauses; the recipe filter set (kcal/protein/time/cost/rating ranges) is served by btree indexes on the denormalized per-serving columns.
- Text search: generated `tsvector` columns on recipes, workouts, menu items, users + `pg_trgm` for fuzzy food search ("chikn breast").
- "Fits my remaining macros": pure SQL — compute remaining targets from today's logs, filter recipes within a tolerance band, order by protein density. No ML.

## 9. Scaling path (write it down, don't build it)

1. **Now:** single Next.js deploy + Postgres + R2. Denormalized counters, materialized trending, good indexes.
2. **~50k WAU:** Redis (rate limits, feed page cache, session cache), pg-boss job queue, read replica for discovery/analytics queries.
3. **~250k WAU:** hybrid feed fan-out (mailbox for mega-creators), dedicated search (Typesense), notification delivery service, image CDN tuning.
4. **Beyond:** extract hot services (feed, search) only when their deploy cadence or load profile diverges — the service layer boundary is the future seam.
