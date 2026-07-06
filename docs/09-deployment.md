# MacroVerse — Deployment (app, backend, OAuth)

The app is a single Next.js deployment: server components + server actions ARE the backend
([02-architecture](02-architecture.md)). There is no separate API server to deploy — one build serves
UI, business logic, and DB access. The only external service is Postgres.

## 1. Backend: hosted Postgres

Dev uses embedded PGlite (`./.data/pglite`). Production uses any hosted Postgres — the driver switches
automatically when `DATABASE_URL` is set ([src/db/client.ts](../src/db/client.ts), [drizzle.config.ts](../drizzle.config.ts)).

**Recommended free-tier options** (per the "free where possible" principle):
- **Neon** (neon.tech) — serverless Postgres, generous free tier, best fit for Vercel
- **Supabase** — Postgres + storage (useful later for the photo pipeline)
- **Railway / Fly Postgres** — if the app itself deploys there

Steps:
```bash
# 1. Create a database, copy the connection string (use the *pooled* URL on Neon/Supabase)
# 2. Push the schema
DATABASE_URL="postgres://user:pass@host/db?sslmode=require" npm run db:push
# 3. Bootstrap reference data: foods, restaurant chains + menus, exercises, workout templates.
#    Insert-only — it skips any table that already has rows, so it's safe to re-run.
DATABASE_URL="..." npm run db:seed:reference
# (The full demo seed WIPES every table, so it refuses to run when DATABASE_URL is set;
#  a staging DB that really wants demo content can pass --force-demo.)
```

For real migrations later (once there are users), switch from `db:push` to generated migrations:
`npx drizzle-kit generate` + `npx drizzle-kit migrate` in CI. Push is fine pre-launch.

## 2. App: deploying Next.js

### Option A — Vercel (least friction)
1. Push the repo to GitHub and import it at vercel.com/new.
2. Set env vars: `DATABASE_URL` (from step 1). Build command / output are auto-detected.
3. Every push to `main` deploys; PRs get preview URLs (point previews at a Neon branch database).

Notes:
- Server actions and the session cookie work out of the box. Cookies are already `secure` in production.
- Nominatim/Overpass calls are outbound HTTPS — no keys needed. Respect Nominatim's 1 req/s policy;
  the built-in 24h `revalidate` on geocoding keeps traffic trivial.

### Option B — Railway / Fly.io / Render (single container)
The repo root has a ready [`Dockerfile`](../Dockerfile) (+ `.dockerignore`) — the platforms above
auto-detect it. Set `DATABASE_URL` in the platform's env settings. Railway can host the Postgres
next to it.

### Option C — bare VPS
`npm ci && npm run build && npm start` behind nginx/Caddy with TLS. Use a process manager (pm2/systemd).

**Production checklist**
- [ ] `DATABASE_URL` set (pooled connection string)
- [ ] `DATABASE_URL="..." npm run db:seed:reference` — foods, chains + menus, exercises, workout templates
- [ ] Register your account in the app, then `DATABASE_URL="..." npm run make-admin -- you@example.com`
- [x] Demo credentials hint on the login page is dev-only (hidden automatically in production builds)

## 3. OAuth ("Sign in with Google/Apple")

Auth today is email/password + guest sessions with an httpOnly session cookie
(`sessions` table, SHA-256 token hash — [src/lib/auth.ts](../src/lib/auth.ts)). OAuth slots in as a
*second way to create the same session* — the session layer doesn't change, mirroring how guest-claim
already attaches credentials to an existing `users` row.

### Schema (add when implementing)
```ts
// oauth_accounts: (provider, provider_account_id) → user_id
export const oauthAccounts = pgTable("oauth_accounts", {
  provider: text().notNull(),            // "google" | "apple" | …
  providerAccountId: text().notNull(),   // Google `sub` claim
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);
// users.password_hash also becomes nullable for OAuth-only accounts (docs/03 already plans this)
```

### Google, manual authorization-code flow (no extra deps, fits the custom-session design)
1. **Google Cloud Console** → Create project → *APIs & Services → OAuth consent screen* (External,
   add scopes `openid email profile`) → *Credentials → Create OAuth client ID (Web)*:
   - Authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
     (plus `http://localhost:3000/api/auth/google/callback` for dev)
   - Copy client ID/secret → env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
2. **Two route handlers:**
   - `GET /api/auth/google` — set a random `state` cookie, redirect to
     `https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=…&response_type=code&scope=openid%20email%20profile&state=…`
   - `GET /api/auth/google/callback` — verify `state`; POST the `code` to
     `https://oauth2.googleapis.com/token`; read `sub`/`email`/`name` from the returned `id_token`
     (or `userinfo` endpoint); then:
     - `oauth_accounts` row exists → `createSession(userId)`, redirect `/`
     - email matches an existing user → link (insert `oauth_accounts`), create session
     - otherwise → insert `users` (null password) + `profiles` (username from email prefix,
       uniquified) + `oauth_accounts`, create session, redirect `/onboarding`
     - **guest upgrade:** if a guest session cookie is present, attach the OAuth identity to the
       guest's row instead of creating a new user — same no-migration claim path as email/password
3. Add a "Continue with Google" button on `/login` and `/register` linking to `/api/auth/google`.

### Alternative: Auth.js (next-auth v5)
If you'd rather not hand-roll token exchange: `npm i next-auth@beta`, configure the Google provider
with the Drizzle adapter. Trade-off: it wants to own the session (JWT or its own tables), so either
adopt its session wholesale or use its OAuth step only and mint your own `sessions` row in the
`signIn` callback. For this codebase the manual flow above is less machinery — it's ~120 lines and
keeps one session system.

**Apple Sign-In** follows the same shape (Apple requires a registered Services ID + private key JWT
for the token exchange) — add it once the native app ships (Phase 4 roadmap), where it's mandatory
for App Store login parity.

## 4. Environment variables (production)

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | hosted Postgres (pooled). Absent = embedded PGlite (dev only) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | when OAuth lands | Google sign-in |
| `NODE_ENV=production` | set by platform | secure cookies, no PGlite global caching |
