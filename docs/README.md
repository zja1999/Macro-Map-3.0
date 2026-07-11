# MacroVerse documentation

This is the canonical documentation portal. It is organized by the question an engineer or agent is trying to answer, not by the order features were built.

## Fast paths

| Question | Document |
|---|---|
| What is this system and how does a request move through it? | [Architecture](architecture.md) |
| How do I install and run it? | [Getting started](getting-started.md) |
| Where does code for a concern live? | [Repository map](repository-map.md) |
| Which tables own this data? | [Data model](data-model.md) |
| Which route renders this screen? | [Route catalog](reference/routes.md) |
| Which action performs this mutation? | [Server action catalog](reference/server-actions.md) |
| Which environment variables and deploy steps matter? | [Operations](operations.md) |
| What are the auth and authorization rules? | [Security and permissions](security.md) |
| What should I test and how? | [Testing](testing.md) |
| Is a feature production-ready, partial, deferred, or externally blocked? | [Product status and roadmap](status-and-roadmap.md) |

## Domain handbooks

- [Identity and profiles](domains/identity-and-profiles.md): sessions, registration, verification, Google identity, onboarding, targets, settings, and account lifecycle.
- [Nutrition and planning](domains/nutrition-and-planning.md): diary snapshots, foods, nutrients, barcode lookup, recipes, restaurants, groceries, and meal prep.
- [Fitness and health](domains/fitness-and-health.md): progress, habits, fasting, sleep, workouts, PRs, routes, and imported health metrics.
- [Community and trust](domains/community-and-trust.md): feed, profiles, interactions, groups, challenges, notifications, reports, moderation, and admin.
- [Platform and integrations](platform-and-integrations.md): PWA, Capacitor/Android, push, health providers, sync normalization, and webhooks.

## Recommended reading by task

- **First repository visit:** root [AGENTS.md](../AGENTS.md) -> [Architecture](architecture.md) -> relevant domain handbook -> reference catalog.
- **Feature change:** relevant domain handbook -> [Route catalog](reference/routes.md) -> [Server action catalog](reference/server-actions.md) -> [Data model](data-model.md).
- **Production or release work:** [Operations](operations.md) -> [Security](security.md) -> [Status and roadmap](status-and-roadmap.md).
- **Bug investigation:** identify the route, trace its component/action/query/schema path with [Repository map](repository-map.md), then consult [Testing](testing.md).

## Sources of truth

1. Executable code and configuration.
2. `src/db/schema.ts` for the intended database shape.
3. This documentation for navigation, invariants, and cross-file behavior.
4. [Status and roadmap](status-and-roadmap.md) for time-sensitive external readiness.

If documentation and code disagree, confirm behavior from code, fix the documentation in the same change, and note uncertainty rather than inventing state.

## Maintenance rules

- Update route/action catalogs when public entry points change.
- Update the data model when a table, relationship, lifecycle, or snapshot rule changes.
- Update operations when a command, variable, provider, deployment, or native prerequisite changes.
- Keep unfinished and environment-dependent claims out of stable domain docs.
- Avoid duplicating large tables of routes, actions, or schema relationships in multiple documents; link to the canonical catalog instead.
