# Security and permissions

## Authentication model

MacroVerse owns its session lifecycle. `createSession()` generates 32 random bytes, sets the raw value in the `mm_session` cookie, and stores only a SHA-256 hash in `sessions`. Sessions last 30 days. Cookies are HTTP-only, same-site `lax`, path `/`, and secure in production.

`getSessionUser()` resolves any valid app session for controlled account-setup use. `getCurrentUser()` additionally requires a password hash, so passwordless Google identities cannot reach ordinary protected reads or mutations. Both reject expired sessions and banned users and require a profile.

## Registration and recovery

- Local registration requires display name, unique lowercase username, and matching 12–64-character password fields; email is null and no verification is required.
- Bcrypt cost 10 remains the password store. Validation also enforces bcrypt's 72-byte input ceiling and login performs a dummy hash comparison for unknown usernames.
- Login throttles the request fingerprint and normalized username independently. A valid password is checked before suspension is disclosed.
- Email verification and reset-token consumption remain backward-compatible for already-issued links, but no live action creates or delivers new email tokens.
- Password changes require the current password or a session reauthenticated within ten minutes, revoke all sessions, and rotate the current browser session.

## Google identity

Google OAuth lives in `/api/auth/google/start` and `/api/auth/google/callback`. The raw state stays in an HTTP-only cookie while only its SHA-256 hash is stored in an expiring, one-time `oauth_authorization_flows` row. Link and reauthentication intents are bound to the initiating user and session. Only identities with `email_verified` are trusted.

The login page renders only allow-listed callback/configuration messages. It never reflects arbitrary provider error text. OAuth continuations use `safeRedirectPath()` and accept only same-origin absolute paths.

MacroTray never receives a website session token through a URL. Pairing creates independent high-entropy approval and device secrets, stores only SHA-256 hashes, expires after ten minutes, requires an onboarded current user to approve, rejects banned users at exchange, and atomically consumes the device secret once. The resulting widget cookie is an ordinary independently revocable `mm_session`. Post-auth continuations accept only same-origin absolute paths.

The Tauri webview permits navigation only on the configured MacroVerse origin and exposes no Tauri IPC capability to remote content. Pairing and other external navigation open in the system browser. The `MacroTray/` user-agent suffix is presentation/routing context only, never authentication or authorization.

An existing legacy local account is auto-linked by email only when that email is verified. New username-only accounts link Google explicitly in Settings. Recovery refuses unlinked identities; linking refuses cross-user provider/email conflicts and one user cannot hold multiple Google identities. Google access/refresh tokens are not retained.

## Authorization hierarchy

Global roles are ordered `user < moderator < admin` in `src/lib/permissions.ts`.

- Use `isModerator`/`isAdmin` for rendering capabilities.
- Use `requireModerator`/`requireAdmin` for pages.
- Use `assertModerator`/`assertAdmin` for server actions.
- `canManageUser` prevents self-management and prevents an actor from managing an equal/higher role. Admin deletion also requires the target to be demoted to `user`.

Group roles (`member < moderator < owner`) are separate. `getGroupAuthority()` combines group role with global staff capability. Ownership transfer, moderator management, member removal, and group-post moderation each have more specific rules in `src/actions/groups.ts`.

## Public content and privacy

Public route access does not imply mutation access. Middleware deliberately allows anonymous recipe, workout, restaurant, meal-prep, and discovery browsing. Actions must require a real current user before save, vote, comment, log, or create operations.

`/privacy` is public and static. `/api/account/export` is deliberately outside the middleware page gate and performs its own session validation, returning `401` without a valid current user. The export is built from user-scoped queries in `src/lib/accountExport.ts`; identity and integration tables use allow-listed projections so password/session/recovery material, rate-limit fingerprints, device tokens, encrypted provider tokens, sync cursors/error payloads, and storage keys cannot enter the response.

Profile visibility, post visibility, public/private go-to orders, route privacy, progress-photo privacy, and moderation removal state must be honored by every new read path. Avoid returning full table rows when a public projection is sufficient.

Progress-photo object keys and R2 URLs stay server-only. Uploads are decoded and rewritten as non-animated WebP, which applies EXIF orientation while discarding EXIF/GPS metadata. Retrieval/download and deletion require a current app session and independently verify both `photos.user_id` and the attached `progress_entries.user_id`; responses are same-origin with private, no-store caching.

## Rate limiting

Database-backed rate-limit events are keyed by a hashed identifier. `requestFingerprint()` combines forwarded IP information with optional user-supplied context. Current auth paths rate-limit registration, login by IP/fingerprint and email, resend verification, reset request, and reset submission. Comments also enforce a request limit.

Because limits live in the application database, cleanup/index behavior and database availability affect enforcement. New abuse-sensitive actions should use `src/lib/rateLimit.ts` rather than ad hoc memory state.

## External secrets

- Never expose database, OAuth client secrets, FCM service-account, webhook, or health-token encryption secrets to client components.
- Health access and refresh tokens are encrypted with AES-GCM in `src/lib/integrations/crypto.ts`.
- Production must provide a stable `HEALTH_TOKEN_ENCRYPTION_KEY` (or deliberately chosen stable fallback secret). Changing the key makes existing ciphertext unreadable.
- OAuth state cookies and session cookies must remain HTTP-only and secure in production.
- Webhook verification tokens are provider-specific environment secrets.

## Response hardening

`next.config.ts` sets CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and a camera/geolocation permissions policy. Changes involving new external images, scripts, styles, connections, or frames may require a CSP update and a production-build/browser check.

## Mutation review checklist

- Is input parsed, bounded, and normalized?
- Is the user authenticated inside the action?
- Is the target loaded and ownership/role/visibility verified?
- For polymorphic subjects, is the allowed type explicit and the subject known to exist?
- Can a caller alter another user's row by supplying an ID?
- Are counters and related rows transactional or otherwise failure-safe?
- Are secrets and private data excluded from client props, logs, errors, and notifications?
- Do account export projections remain allow-listed when a sensitive column is added?
- Does deletion cascade as intended, or should it be soft removal/audit history?
