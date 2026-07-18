# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

The app itself is still a single hand-authored file: `index.html`. There is no build step for it, no bundler — the entire app (markup, styles, and a React app written with `React.createElement` calls, no JSX) lives in that one file, and edits should keep working exactly the same way they always have: open `index.html`, edit, done. Runtime dependencies (Tailwind, React, fonts) are loaded from CDNs directly in `<head>`.

The `React.createElement(...)` call style (including the `void 0`-style optional-chaining downlevel patterns, e.g. `(_a = x) !== null && _a !== void 0 ? _a : y`) indicates this file's script was compiled/transpiled from JSX+TS and then pasted in — there is no source `.tsx` file in this repo, only the compiled output. When editing, keep new code consistent with this same `React.createElement` style (no JSX) unless the user sets up an actual build pipeline.

### Native app wrapper (Capacitor)

This repo is *also* an npm project wrapping `index.html` for iOS/Android distribution via Capacitor — additive, doesn't change day-to-day `index.html` editing. For sync steps, `native-bridge.js`, and Codemagic details, see the `native-build` skill.

## Running / testing changes

There is still no dev server or build command for the app itself. To try changes:
- Open `index.html` directly in a browser, or serve the directory with any static file server (e.g. `python -m http.server` or `npx serve`) since it makes cross-origin fetches to Supabase.
- To test inside the native wrapper, see the `native-build` skill.
- `npm test` runs the test suite (Node's built-in test runner, `test/*.test.js`/`.mjs`); `npm run lint` runs ESLint.

## Architecture

Everything is in `index.html`, organized top-to-bottom as:

1. **Config constants** — `SUPABASE_URL`, `ANON_KEY`, `AUTH`/`REST` base URLs, `CLIENT_PLAN_LINKS`/`COACH_PLAN_LINK`, `SESSION_KEY` (localStorage key). The Supabase anon key is a public client-side key by design (RLS enforces access control server-side).
2. **Icons** — small inline SVG icon components built on a shared `Icon` wrapper, avoiding an external icon library.
3. **Scoring engine** — pure functions (`sleepScore`, `nutritionScore`, `exerciseScore`, `stressScore`, `totalScore`, `scoreColor`, `DEFAULT_GOALS`).
4. **Streaks & weekly comparison** — `computeStreak`, `weeklyComparison`.
5. **Recommendation engine** — `tier`, `RECS`, `buildRecommendations`, `PROTOCOLS`/`ProtocolCard`.
6. **Body composition → nutrition direction** — `goalDirectionFromBody`, `CATEGORY_TO_SUPPLEMENT_GOAL`, `adaptiveNoteApplies`.
7. **UI components** — `SimpleLineChart`, `ScoreRing`, `FieldSlider`, `BodySelector`/`BodyImageButton`, `AuthScreen`, `Dashboard`, `App`.
8. **Coach panel components** — `RoutineExerciseRow`/`RoutineBuilder`, `RoutineCard`, `CoachClientsPanel`, `CoachPanel`, `MyRoutinesSection`.

## Personas: client vs. coach

This is one file serving two different people through the same `Dashboard` component:
- **Client** (the default, ~everyone): the score tracker, goals, premium recommendations, and — if a coach has assigned them one — a read-only "Mi rutina asignada" section.
- **Coach** (`coaches` row where `id = auth.uid()` — currently just Mario): everything a client sees, *plus* a "Panel de coach" section for managing their own client roster, building routines from the `exercises` library or cloning a public `routine_templates` row, and assigning routines to their clients. Whether the current user is a coach is checked once via `GET {REST}/coaches?id=eq.{userId}` (`checkCoachStatus`, state `isCoach`) — there's no separate coach login or route, no tab/toggle, the section is just appended when present.
- Coach status is unrelated to `is_premium()` — a coach's own biohacker-score plan (free/premium/trial) is independent of whether they're a coach, and vice versa (a client can be assigned a routine regardless of their own plan).

### Data flow / backend

All persistence is direct client-side REST calls to Supabase (PostgREST) against project `bciwxtjgabbnuxjxrwzt`, no server code in this repo:
- **Auth**: `POST {AUTH}/token?grant_type=password` (login), `POST {AUTH}/signup` (signup), `POST {AUTH}/token?grant_type=refresh_token` (silent refresh, done every 45 min and on app load via a refresh token persisted in `localStorage` under `SESSION_KEY`; only the refresh token is persisted, not the access token).
- **`profiles` table**: one row per user — per-user goals (`goal_sleep_hours`, `goal_fasting_hours`, `goal_exercise_minutes`, `goal_stress_max`), body-composition selection (`body_gender`, `body_current_stage`, `body_target_stage`), and premium bookkeeping (`plan` is a legacy/display-only column — **do not gate on it**; `premium_source` is `'paid' | 'comp_trainer' | 'trial' | null` and `trial_ends_at` backs the `trial` case). Read via `GET {REST}/profiles?id=eq.{userId}&select=...`, written via `PATCH {REST}/profiles?id=eq.{userId}`.
- **`daily_entries` table**: one row per user per day (`entry_date`), holding raw metric inputs (`sleep_hours`, `sleep_quality`, `fasting_hours`, `nutrition_quality`, `exercise_minutes`, `exercise_intensity`, `stress_level`). Upserted via `POST {REST}/daily_entries?on_conflict=user_id,entry_date` with `Prefer: resolution=merge-duplicates`. Read via `GET {REST}/daily_entries?user_id=eq.{userId}&order=entry_date.asc&limit=60`.
- **`supplement_recommendations`** / **`nutrition_recommendations`**: static, coach-curated content (5 rows / 3 rows respectively as of writing). RLS lets *any* authenticated user read both tables regardless of premium status (`premium_only` is metadata, not an access-control column) — premium gating for this content is UI-only, done via `isPremium` before the tables are even fetched (`loadPremiumContent`, triggered by a `useEffect` on `isPremium`).
- **`coaches`** (id = `profiles.id`; roster + workout-routine business, priced per coach at $14–134/mo by client-count tier via `subscription_tier`) — read own row via `GET {REST}/coaches?id=eq.{userId}`. **No INSERT policy exists**; a profile becomes a coach only via direct SQL (there is no self-serve coach signup in the UI).
- **`coach_clients`** (coach_id → coaches, client_id → profiles, `client_id` unique i.e. one coach per client) — coach can read/manage rows where `coach_id = auth.uid()`; a client can only read their own link. **RLS blocks a coach from looking up an arbitrary profile by email** (profiles' SELECT policy is `auth.uid() = id`), so adding a client from the UI goes through the RPC below rather than a direct insert.
- **`public.add_coach_client_by_email(p_email text)`** — `SECURITY DEFINER` Postgres function (added specifically to work around the RLS gap above). Derives the coach from `auth.uid()` (never trust a client-supplied coach id), verifies a `coaches` row exists, looks up the profile by email, rejects self-add and already-linked clients, then inserts into `coach_clients`. Called via `POST {REST}/rpc/add_coach_client_by_email` with `{ p_email }`; errors surface via PostgREST's `{ message }` body from the `RAISE EXCEPTION` text, shown as-is in the UI (`handleAddClient` in `Dashboard`).
- **`exercises`** — flat library (`name`, `muscle_group`, `equipment`, `instructions`, `video_url`), readable by any authenticated user. Used only by the coach's routine builder to populate the exercise `<select>`.
- **`routine_templates`** — coach-authored or `is_public = true` starter routines; `content` is a JSON array of `{ exercise, sets, reps, rest_seconds }` (`exercise` is a **plain name string**, not a foreign key to `exercises`). `RoutineBuilder`'s template dropdown copies a template's `content` straight into its own exercise rows.
- **`routines`** (coach_id → coaches) — a coach's own routines, same `content` shape as templates above. Coach has full `ALL` access to their own rows via RLS; created via plain `POST {REST}/routines` (no RPC needed, RLS `WITH CHECK` covers it).
- **`routine_assignments`** (routine_id → routines, client_id → profiles) — links a routine to a client. RLS lets a client read their own assignments, and a coach manage assignments on routines they own (checked via an `EXISTS` subquery, not a column on this table) — so a coach's "which of my routines is assigned to whom" view (`coachAssignments` in `Dashboard`) fetches *all* visible assignment rows unfiltered and the RLS policy does the scoping.
- All scoring/streak/recommendation logic runs client-side over the last 60 days of entries fetched on load — there's no server-side aggregation.

### Premium gating

Premium status is determined by the Postgres function `public.is_premium(profile_id uuid)` (`SECURITY DEFINER`, checks `premium_source`/`trial_ends_at`), called via `POST {REST}/rpc/is_premium` with body `{ profile_id: session.user.id }` inside `loadPlan()`. The result is stored in `Dashboard`'s `isPremium` state and is the **only** thing gating section rendering ("Tus metas", "Recomendaciones de hoy", "Suplementos y nutrición sugeridos") — never gate new premium content on `profiles.plan`. Free users see a blurred teaser + "Desbloquear con Premium" CTA in the same visual pattern per section; follow that pattern for any new premium section rather than hiding it outright.

### Monetization

Upgrade flow is a Stripe Payment Link (`CLIENT_PLAN_LINKS`/`COACH_PLAN_LINK`) with `client_reference_id` set to the Supabase user id so payment can be reconciled server-side. Reconciliation happens in this repo's `supabase/functions/stripe-webhook`, which verifies the Stripe signature (see `_shared/stripe-signature.mjs`) and sets `profiles.premium_source = 'paid'`. "Ya pagué, actualizar estado" / "Actualizar estado" buttons just re-run `loadPlan()` (which re-fetches the profile and re-checks `is_premium()`) rather than polling.

## Conventions to preserve when editing

- UI copy is in Spanish (`lang="es"`); keep new user-facing strings in Spanish for consistency.
- Color palette is defined ad hoc via hex literals passed as `style`/Tailwind arbitrary values (dark background `#060809`, panel `#11161F`, border `#1E2535`, accent cyan `#3DDCFF`), not a Tailwind theme config — match existing hex values rather than introducing new ones.
- No component splitting across files — everything stays in the one `<script>` block in `index.html`.
- When adding a new deeply-nested `React.createElement` tree, don't hand-count parens across 10+ lines of inline nesting — assign the subtree to a `const`/`let` first (see `premiumContentSection` in `Dashboard`) and reference it in the JSX. There's no bundler/TS here to catch a mismatched paren before runtime, and dense nesting makes a stray/missing `)` easy to introduce and hard to spot by eye.
