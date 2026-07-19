# Architecture

This file records architecture decisions for `biohacker-score`. It grows feature by feature, extended (not rewritten) each time the `design-code-architecture` skill runs. See `CLAUDE.md` for the canonical day-to-day architecture reference (data flow, tables, conventions) — this file is specifically for the *decisions* behind that shape, one dated entry per feature.

---

## Feature: Galería de recetas saludables (Pro/Elite)

**Date:** 2026-07-18
**Journey tracker:** `docs/DESIGN-CODE-ARCHITECTURE-PLAN.md`

### System Context

A read-only gallery of curated healthy recipes (title, photo, ingredients, prep steps), gated to the Pro and Elite subscription tiers. First feature in the app gated by *specific tier* rather than by the existing binary `is_premium()`. No new infrastructure: same `index.html` single-file app, same Supabase project, same Cloudinary account already used for body-composition images. Load is trivial — comparable to the existing `exercises`/`supplement_recommendations` static tables (dozens of users, read-mostly, content curated by hand).

### Layer Map & Dependency Rule

No new layer or boundary. This feature is a UI section (`Dashboard`) reading a new Supabase table through the exact same `cachedFetchJSON` static-content path already used for `exercises`, `supplement_recommendations`, `nutrition_recommendations`, `subscription_plans` (see `CLAUDE.md` § "Static content cache"). Framework/DB details stay confined to the same places they already live in this codebase — nothing new crosses the existing boundary.

### Bounded Contexts & Context Map

No new bounded context. `Recipe` joins the existing "coach-curated static content" context alongside `Exercise`, `SupplementRecommendation`, `NutritionRecommendation` — same lifecycle (Mario writes it, the app only reads it), same trust model (RLS open to any authenticated user, gating is a client concern).

### Domain Glossary (Ubiquitous Language)

| Term | Meaning | Code name |
|---|---|---|
| Receta / Recipe | A single curated recipe: title, image, ingredient list, ordered prep steps | `recipes` row |
| Tier | A client's subscription level: `basico`, `pro`, `elite`, ordered by price/capability | `subscription_tier` (existing column), `resolveClientTier()` (existing helper) |
| Tier gate | The minimum tier required to see a piece of content | `min_tier` column on `recipes`; checked via new `tierAtLeast()` |

### Data & Storage Decisions

**New table `recipes`** (Postgres, same shape/spirit as `exercises`):

```sql
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,           -- Cloudinary URL, raw string, same pattern as BODY_IMAGES
  ingredients jsonb not null,        -- array of strings, e.g. ["200g pechuga de pollo", ...]
  prep_steps jsonb not null,         -- ordered array of strings
  prep_time_minutes int,
  servings int,
  min_tier text not null default 'pro',  -- 'basico' | 'pro' | 'elite'
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
create policy "Authenticated users can read recipes"
  on public.recipes for select
  to authenticated
  using (true);
```

Model/engine fit: single Postgres table, no polyglot persistence — this is static reference data with one writer (Mario, by hand) and one read pattern (fetch-all-ordered-by-display_order), same as every other coach-curated table in this app. `jsonb` for `ingredients`/`prep_steps` instead of a normalized ingredients table: matches the existing `routines.content` pattern, avoids a many-to-many join nobody needs for 20 read-only recipes.

**Isolation/consistency:** not applicable — no concurrent writes, no write-skew-prone paths. This table is written by one person via manual SQL, same as `supplement_recommendations` today.

**Images:** Cloudinary, reusing the existing account (`res.cloudinary.com/db9jsvtr3/...`). `image_url` stored as a raw string column, same as `BODY_IMAGES` already does — no new vendor, no new abstraction layer.

**Client-side gating (the one new piece of domain logic):**

```js
const TIER_ORDER = ["basico", "pro", "elite"];
function tierAtLeast(tier, minTier) {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minTier);
}
// usage in Dashboard:
const currentTier = resolveClientTier(premiumSource, subscriptionTier); // existing helper
const canSeeRecipes = tierAtLeast(currentTier, "pro");
```

Free/Básico users see the gallery with the existing blurred-teaser + "Desbloquear con Pro" pattern (same visual convention as other premium sections), not a hidden section — matches `CLAUDE.md`'s existing premium-gating convention.

### Decision Log

| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 2026-07-18 | New `recipes` table, RLS open to `authenticated`, gating done client-side | Consistency with every other static-content table in the app | RLS filtering rows by tier — rejected, breaks the established permission model for no real security benefit (content isn't sensitive) |
| 2026-07-18 | `ingredients`/`prep_steps` as `jsonb` arrays | Matches `routines.content`; avoids a normalized ingredients table for 20 read-only rows | Normalized `recipe_ingredients` table — rejected as over-engineering for this scale |
| 2026-07-18 | Images in Cloudinary (existing account), raw URL string, no abstraction layer | Zero new integration, matches `BODY_IMAGES`' existing pattern | Supabase Storage — rejected, new integration surface with no benefit over what already works |
| 2026-07-18 | New `tierAtLeast(tier, minTier)` helper over `TIER_ORDER`, built on the existing `resolveClientTier()` | First feature needing "tier X or above" instead of binary premium; reuses all existing tier-resolution logic | A precomputed boolean column on `profiles` — rejected, would duplicate `subscription_tier` as a second source of truth |
| 2026-07-18 | v1 has no categories, no nutrition info, no favorites, no search | Scope matched to 20 recipes and the actual problem (show a gallery), not a hypothetical bigger one | Building all four now — rejected, no evidence any of them are needed yet (see `docs/TECH-DEBT.md`) |
