# Features Added

MacroVerse is a stable production web app at https://macroverse.vercel.app. This document is the current record of implemented product capability, not a future roadmap.

## Accounts and profiles

- Email/password registration, email verification, password reset, rate limiting, persistent sessions, and account deletion.
- Google OAuth sign-in and account linking are implemented in code; they activate once the production database migration and provider configuration are applied.
- Onboarding, nutrition targets, dietary preferences, units, public/private profiles, profile photos, and user settings.

## Nutrition and planning

- Daily macro diary, custom foods, favorites, frequent foods, nutrition CSV imports, and personal ingredients.
- Recipe discovery, creation, editing, saving, voting, comments, logging, and macro provenance/confidence.
- Restaurant discovery, map/list search, nearby locations, item builder, combo meals, saved go-to orders, and logging.
- Grocery lists and meal-prep plans assembled from recipes.
- Micronutrient display with percent daily values, barcode lookup (camera/manual entry), fasting timer, and manual sleep logging.

## Fitness and progress

- Progress dashboard with measurements, progress photos, habits and streaks, plus no-scale mode.
- Workout templates, community workouts, freeform workout logging, strength/cardio/mobility tracking, personal-record detection, and workout voting/saving.

## Community and trust

- Public feed, posts, reactions, comments, following, blocks, profiles, groups, and auto-scored challenges.
- Reporting, moderation queue, content warnings, audit log, bans, admin tools, feedback collection, and in-app notifications.

## Mobile and platform foundation

- Installable web app with offline shell.
- Capacitor Android shell, haptics, status bar/back-button handling, deep-link routing, splash/icon assets, native barcode scanning, and in-app review prompt.
- Push-notification code and Firebase Android wiring exist but are intentionally not a current launch requirement.
- Health-integration foundation exists for Strava/Fitbit and native health uploads; live wearable sync is not yet complete.

## Verification baseline

- The project typechecks with `node node_modules/typescript/bin/tsc --noEmit`.
- `npm run build` completes successfully.
- Playwright is configured for critical end-to-end flows via `npm run test:e2e`.
