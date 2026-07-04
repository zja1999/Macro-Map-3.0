# Macro Map — Moderation, Trust & Safety

## 1. Roles

| Role | Scope | Powers |
|---|---|---|
| User | — | report, block, mute |
| Group moderator | their group | remove group posts, mute members in group, pin |
| Community mod (reputation-gated, ≥500 + invite) | global reports queue | triage: dismiss obvious-invalid, escalate, add warning labels |
| Moderator (staff) | global | remove content, warn/suspend users, verify macros, resolve corrections |
| Admin | global | everything + bans, role assignment, data imports, featuring |

Every action writes to `moderation_actions` (immutable audit log, visible to admins).

## 2. Report pipeline

1. Any subject reportable with a structured reason (`inaccurate_macros`, `unsafe_advice`, `harassment`, `body_shaming`, `ed_content`, `spam`, `stolen_content`, `fake_transformation`, `medical_claim`, `other`).
2. Reports land in the queue (admin dashboard) sorted by severity class: safety reasons (`ed_content`, `unsafe_advice`, `harassment`) jump the line.
3. **Auto-mitigation thresholds:** ≥3 unique reports on one subject within 24h → content soft-hidden pending review (author notified, appeal path). `inaccurate_macros` reports never hide — they lower macro confidence and badge the recipe instead ([06 §2](06-recipes-voting-reputation.md)).
4. Outcomes: dismiss / warning label (`content_warnings`) / remove / warn author / suspend / ban. Reporter gets a resolution notification (and reputation if valid).
5. Appeals: single re-review by a different moderator.

## 3. Content policy (enforced categories)

Prohibited: starvation-diet promotion (protocols under safety floors), dangerous supplement promotion, ED-behavior content (purge/extreme-restriction technique sharing), body shaming/harassment, fake or stolen transformations, unsafe training advice presented as instruction, medical claims ("cures/treats"), spam/affiliate flooding, stolen recipes (plagiarism reports → takedown flow), deliberately falsified nutrition data.

Warning-label (not removal) tier: unverified extreme claims, aggressive-deficit content with context, non-cited "science" claims → `misinformation` or `unsafe_diet` label rendered on the content.

## 4. Eating-disorder-sensitive design (product-level, not just policy)

- **Hard calorie floor** on targets (server-enforced, supportive copy, no override in UI).
- **No-scale mode:** first-class tracking style — weight prompts, weight charts, and weigh-in notifications suppressed globally; habit/adherence metrics substitute.
- Weight, body-fat, and measurements **never public by default**; no public weight leaderboards anywhere; challenges are behavior-based, never weight-loss-amount based.
- No "days without eating"-style streaks; streaks reward logging/protein/training, never restriction.
- `ed_content` reports route to the priority queue; actioned content replaced with a resources interstitial (region-appropriate helplines).
- Copy guidelines: adherence framed as consistency, not virtue; no "guilt" language in any notification or empty state (enforced via copy review checklist in the design system).

## 5. Rate limits & spam defense

Per-user sliding windows (Postgres counters, Redis later): posts 10/day, comments 60/day, reports 20/day, recipe submissions 5/day (new accounts: half). Link-heavy posts from <10-reputation accounts auto-queued. Duplicate-recipe detection (name+ingredient fuzzy match) prompts "similar recipe exists — fork instead?".

## 6. Admin panel

Specified in [04-screens §27](04-screens.md); backed by `/api/v1/admin/*` with role middleware + audit logging. Nutrition data import: CSV column-mapper with validation preview and dry-run diff; PDF submissions attach to `restaurant_requests` for manual entry in MVP (automated extraction is roadmap).
