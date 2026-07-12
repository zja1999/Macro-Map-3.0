# Fitness and health

## Scope and entry points

This domain owns progress measurements/photos, habits/streaks, fasting, manual sleep, daily health metrics, workout templates/community routines, workout logging, routes, and personal records.

- Routes: `/progress`, `/workouts`, `/workouts/new`, `/workouts/[id]`, `/workouts/log`.
- Actions: `progress.ts`, `fasting.ts`, `sleep.ts`, `workouts.ts`.
- Libraries: `workouts.ts`, relevant reads in `queries.ts`, `units.ts`, integration normalization/sync.
- Components: progress forms, habits section, fasting card, workout forms.

## Progress and habits

Progress entries store optional weight, body fat, circumferences, note, and source. A user may record only the measurements relevant to their tracking style. All body measurements are metric at rest and converted at the form/display edge.

Progress photos support up to four JPEG, PNG, or WebP sources per multipart upload. The server rotates from EXIF orientation, strips metadata/GPS, limits the longest edge to 1600 pixels, converts to WebP, and stores the private object in R2 (or `.data/media` outside production). `photos` owns storage metadata and `media_attachments` connects one or more photos to a dated `progress_entry`. The timeline groups by date and offers private two-date comparison; all viewing, downloading, and deletion goes through an authenticated, ownership-checked application route.

Default habits are created lazily by `ensureDefaultHabits()`. Habit completion is a composite habit/date row; streaks are computed from dates rather than stored. Archive preserves history. Toggling must verify the habit belongs to the current user.

No-scale mode is a presentation/tracking choice. Keep weight entry/history optional and avoid weight-centric prompts for that style.

## Fasting and sleep

An active fast is a `fasting_windows` row with no end timestamp. Start, end, and discard actions are user-scoped. Elapsed display is client-timed while persisted timestamps are authoritative.

Manual sleep is one row per user and wake-up date. Bed and wake time are local strings; `duration_min` is computed and used analytically, avoiding timezone round trips. Quality is optional. Provider sync may upsert provider sleep, but a manual row for the date wins.

## Workout definitions

`exercises` is a reference catalog. Its activity type determines whether the UI renders strength, cardio, or mobility controls. `workouts` contains a planned JSON structure and can be:

- an official template (`author_id` null and `is_template` true);
- a community/user workout;
- a fork of another workout;
- strength, cardio, mobility, or mixed.

Only admins manage official templates. User workouts support save/vote counters. Detail and list reads must respect publication/moderation state and anonymous browsing rules.

## Workout logs

Completed sessions can reference a planned workout or be freeform. JSON entries are discriminated:

- strength: exercise and sets with reps/weight or timed hold, optional RPE/rest;
- cardio: activity, duration, and optional distance/speed/incline/resistance/stroke/power/calories/route note;
- mobility: duration, focus area, effort, and notes;
- legacy strength rows remain supported for old data.

Storage uses kilograms, meters, kilometers/hour, minutes, and seconds as named. `src/lib/workouts.ts` owns summaries and display conversions.

## Personal records

After a strength log, `detectPrs()` compares extracted set performance and writes queryable personal-record rows. Metrics are:

- `e1rm`: Epley estimated one-repetition maximum;
- `volume`: total weight × reps;
- `reps`: best repetitions.

Timed holds have `reps: 0` and do not generate repetition or e1RM records. PR sharing creates a social post and should remain an explicit user action.

## Imported health data

Normalized provider samples can write daily health metrics, workout logs/routes, sleep/stages, and progress. Idempotency uses `external_sample_links`. Manual sleep/progress takes precedence. Imported routes default private and include start/end hiding distances.

Provider availability and completeness differ; read [Platform and integrations](../platform-and-integrations.md) before relying on imported data. In particular, a listed metric in a provider descriptor is not proof that every fetch/refresh/webhook path is complete.

## Safe change checklist

- Keep canonical units metric and convert only at boundaries.
- Preserve legacy workout-log readability when changing JSON types.
- Validate exercise IDs and activity-specific fields server-side.
- Keep imported samples idempotent and manual precedence intact.
- Default route and progress media privacy conservatively.
- Recompute/extract queryable PRs without rewriting the original log document.
- Test templates, freeform logging, each activity kind, and empty/optional measurement states.
