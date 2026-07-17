# Visual audit fixes — Top 5 (design)

**Source:** `auditoria-diseno-ux-marketing.md` (external audit Mario supplied, 2026-07-17), "Top 5 prioridades" section. This spec covers only that first block; the remaining 8 audit items (pricing-card hierarchy, hover micro-interactions, home length, social proof, gold/Elite accent, ring glow, macro-cards, mitochondria pulse) are explicitly out of scope here and will get their own spec later.

**Repos touched:** `biohackerlatino-web` (marketing site — no git, manual Netlify deploy, no shared JS/templates across its 10 HTML pages) and `biohacker-score` (this repo — git-tracked, single-file `index.html` app + Supabase backend). This doc lives in `biohacker-score` because it's the only one of the two under version control; treat the `biohackerlatino-web` sections as equally binding even though they can't be committed there.

**Verified against real code before writing this spec** (not taken on faith from the audit doc):
- Bug 1 (0% counters): confirmed in `biohackerlatino-web/index.html` (audit calls it `home.html` — same file, minor naming slip in the source doc). There are two independent animation paths gated by `if (isDesktop)`: a GSAP ScrollTrigger path (desktop, works correctly) and an `IntersectionObserver({ threshold: 0.4 })` path (mobile/non-desktop, the broken one) — lines ~349-367 for the `.ev-stat` counters, and a second, separate `IntersectionObserver({ threshold: 0.4 })` for the score ring at lines ~406-418 with the same bug.
- Bug 2 (no mobile menu): confirmed — `assets/style.css` (lines ~338-341) hides `.nav-links a:not(.btn)` under 720px and defines `.nav-toggle { display: none }`, but no `<button class="nav-toggle">` exists in any page's HTML. The `<nav class="nav-links">` markup (and this bug) is duplicated identically across all 10 site pages: `index.html`, `blog/index.html`, `blog/*.html` (5 articles), `precios/index.html`, `suplementos/index.html`, `privacidad/index.html`.
- Suplementos video link: `suplementos/index.html` renders `amazonLink` from `s.amazon_affiliate_url`, a column on the `supplement_recommendations` Supabase row (not a hardcoded JS map) — confirms a DB column is the right shape for `video_url` too, rather than the audit's suggested hardcoded `VIDEO_BY_NAME` object.

## 1. Mobile nav menu — `biohackerlatino-web`, all 10 pages

**Problem:** below 720px, Blog/Suplementos/Precios/YouTube links are hidden with no way to reach them; only the header CTA button survives.

**Fix:**
- `assets/style.css` (single shared file, one edit covers all pages): add `.nav-toggle` visibility + a slide-down `.nav-links.open` panel, per the audit's CSS.
- Each of the 10 pages: add the hamburger `<button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">` markup next to the existing `.nav-links`, plus a small inline `<script>` wiring the toggle (`classList.toggle('open')`, flip `aria-expanded`). Same repetition pattern already used for the "Precios" nav link (per project history) — no templating system exists to avoid this.
- Manual QA: open each of the 10 pages at ≤720px width, confirm the menu opens/closes and every link is reachable.

## 2. 0%-stuck counters — `biohackerlatino-web`, `index.html` only

**Fix, scoped to the two `IntersectionObserver` call sites (mobile/non-desktop path only — the desktop GSAP path is untouched, it already works):**
- `.ev-stat` counters (~line 364): `{ threshold: 0.4 }` → `{ threshold: 0.15, rootMargin: "0px 0px -10% 0px" }`.
- Score ring (`ringObserver`, ~line 416): same threshold/rootMargin change.
- Add the 3-second fallback from the audit (checks `statEl.textContent === '0' + suffix`, force-sets the final value) to both call sites, so a user who scrolls past very fast — or has `prefers-reduced-motion` — still ends up seeing the real number instead of a stuck `0%`.
- Manual QA: throttle/fast-scroll test on a real mobile viewport (not just DevTools resize) for both the stat cards and the phone-mock score ring.

## 3. App registration/login screen — `biohacker-score`, `index.html`

**Decisions confirmed with Mario:** full version (particles included, not just the gradient), and the `#0A0E14` → `#060809` background swap applies **app-wide**, not just the auth screen.

- Port `initParticles` (~30 lines, canvas + `requestAnimationFrame`, no new dependencies) from `biohackerlatino-web/index.html` into `biohacker-score/index.html`'s script block. It becomes a second, independent copy — there is no shared module between the two repos, consistent with how everything else in this app is a single self-contained file.
- Add a `<canvas>` to `AuthScreen`'s markup, mounted the same way the site's `#heroParticles` is, and call `initParticles` on it.
- Add the radial-gradient background to `.auth-screen` (or the equivalent inline style, since this file has no external stylesheet) per the audit's CSS.
- Global find-replace of the substring `#0A0E14` → `#060809` across `index.html`. Confirmed usages include the top-level `<style>` block's `body` rule, an inline style on `#boot-error`, and dozens of Tailwind arbitrary-value classes (`bg-[#0A0E14]`, including opacity variants like `bg-[#0A0E14]/70` and `bg-[#0A0E14]/90`) — a plain substring replace correctly covers all of these since the hex code itself is what changes, not the surrounding class syntax. Per `CLAUDE.md` this hex is used ad hoc, not a central theme token. `#11161F` (panel) and `#1E2535` (border) stay as-is; only the base background hex changes.
- Manual QA: load the app in a browser, confirm the login screen no longer looks like a "blank drop" after clicking through from the marketing site, and spot-check a couple of other screens (Dashboard, CoachPanel) still look correct with the new background.

## 4. Sticky mobile CTA — `biohackerlatino-web`, `index.html` only

**Scoped to the home page only** (per discussion — this is where the audit identifies the problem, a ~12,000px page with no CTA visible after the hero; not extended to blog/precios/suplementos in this pass).

- Add `.sticky-cta` bar (fixed bottom, blurred glass background, translateY slide-in) per the audit's CSS.
- `IntersectionObserver` on `.hero`, toggling `.sticky-cta.visible` when the hero scrolls out of view.
- Manual QA: scroll the mobile view past the hero, confirm the bar appears/disappears correctly and doesn't overlap other fixed elements (nav, footer).

## 5. "Ver el análisis" video link on supplement cards — `biohacker-score` (DB) + `biohackerlatino-web` (render)

**Deviates from the audit's suggested approach** (a hardcoded `VIDEO_BY_NAME` JS object) in favor of matching the existing `amazon_affiliate_url` pattern, since that's how the sibling Amazon link is already wired:

- New migration on `supplement_recommendations`: add nullable column `video_url text`.
- `suplementos/index.html`: render a second button (`▶ Ver el análisis`, `btn-outline btn-sm`, matching the audit's markup) next to the existing Amazon button, **only when `s.video_url` is present** — mirrors the existing `amazonLink` conditional exactly.
- Mario will supply the YouTube URLs (confirmed: he has them, will paste at the end of this session — flagged that one video might be missing, so this item may ship with 4 of 5 rows filled and the 5th left `null`/hidden until he has it, which the conditional render already handles gracefully).
- No code blocks on missing URLs — the column defaults to `null`, the button just doesn't render for that row until filled in later (same non-event as a supplement currently missing a photo, which already falls back to its icon).

## Out of scope for this spec (confirmed with Mario, deferred)

Everything else in the audit document: pricing-card visual hierarchy (1.3), card hover micro-interactions (2.3), "Mito contra verdad" video thumbnails (2.2), home page length/pacing (3.1), blog/suplementos placeholder cards (3.2), social-proof strip (4.1 — blocked on real subscriber/user numbers), lead-magnet value bullets (4.3), and the "premium aesthetic direction" section (5.1-5.4: gold Elite accent, ring glow-on-complete, macro-cards with progress bars, mitochondria pulse). These get their own brainstorming pass later.

## Testing

Neither repo has automated UI/visual tests. `biohacker-score` has a Node test suite (`npm test`) covering pure scoring/matching logic and a syntax-check that parses every inline `<script>` block — the syntax-check test will still guard the `index.html` edits in item 3 against a stray paren, but none of these 5 items are covered by new automated tests; verification is manual, browser-based, at both desktop and mobile viewports, per item above.
