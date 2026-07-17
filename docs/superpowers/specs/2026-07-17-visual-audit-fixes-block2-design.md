# Visual audit fixes — Block 2 (5 autonomous items) (design)

**Source:** same audit as Block 1 (`auditoria-diseno-ux-marketing.md`), the 5 remaining items that need no data/decision from Mario first. See `docs/superpowers/specs/2026-07-17-visual-audit-fixes-design.md` for Block 1 (shipped) and the full list of what's deferred.

**Repo touched:** `biohackerlatino-web` only (no git, manual Netlify deploy) — none of these 5 items touch `biohacker-score`.

**Deferred to a later block (confirmed with Mario, not forgotten):**
- Social-proof strip (4.1) — blocked on real subscriber/user numbers.
- "Mito contra verdad" video thumbnails (2.2) — blocked on Mario picking which YouTube Short maps to which myth.
- Premium aesthetic direction (5.1-5.4: gold Elite accent, ring glow-on-complete, macro-cards, mitochondria pulse) — a new design decision, not a fix; needs its own brainstorming pass.

**Verified against real code before writing this spec** (the audit doc has been wrong about current state twice before this session — stale Stripe prices, a "duplicate" blog post that was actually a deliberate URL match — so every claim below was checked, not assumed):
- Card hover (2.3): **partially already exists.** `assets/style.css:406-412` already has `a.card:hover` (works for blog cards, which are `<a class="card">`). What's actually missing is hover on the `.card` divs that aren't anchors — supplement review cards and pricing cards (`<div class="card review-card">`, `<div class="card price-card">`). The fix is broadening the existing selector from `a.card:hover` to `.card:hover`, not adding a new duplicate rule.
- Blog/suplementos "empty" grids (3.2): **the audit's framing is stale.** `blog/index.html` has 5 published articles (not "un solo artículo" as the audit says) and `suplementos/index.html` has 5 supplements — both use the shared `.grid` class (`grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`), which renders 3 columns at desktop width. 5 items in a 3-column grid leaves exactly **1** empty slot in row 2, not a large gap. One placeholder card per grid, not two.
- Home length (3.1): **only 2 of the home page's 7 `<section>` elements use the generic `.section` class** (`padding: 4.5rem 0`) that the audit's snippet targets. The other 5 (`hero-clinico`, `method-pin` — a pinned horizontal-scroll section, `split-section` ×2, `dna-banner`) have bespoke padding baked into their own rules and are not safe to blindly shrink without seeing the result rendered — confirmed with Mario to do a conservative pass (the 2 generic sections + background alternation) rather than guess at the bespoke sections' spacing blind.
- Pricing badge (1.3): cards render dynamically from `subscription_plans` via `renderCard(p)` in `precios/index.html` — matching by `p.tier === "pro"` is more robust than the audit's array-position assumption, since `subscription_plans` is fetched sorted by `price_usd.asc` and tier order isn't guaranteed to stay basico/pro/elite forever.
- Lead-magnet bullets (4.3): the checkmark-bullet visual pattern the audit wants already exists as `.price-features` — but it's defined in `precios/index.html`'s **local** `<style>` block, not the shared `assets/style.css`, so it's not usable on the home page as-is. This spec adds an equivalent shared class (`.lead-benefits`) instead of duplicating the local one.

## 1. "Más elegido" badge on the Pro pricing tier

`precios/index.html`'s `renderCard(p)` gets a conditional badge + highlighted border/scale when `p.tier === "pro"`, per the audit's CSS (`.pricing-card.featured`, `.badge-featured`) — renamed slightly to fit this page's existing `.price-card` naming (`.price-card.featured`).

## 2. Card hover for non-anchor cards

Broaden `assets/style.css`'s existing `a.card:hover` selector (line 406) to plain `.card:hover`. No new rule, no duplication — the transition properties are already on the shared `.card` base rule (line 403), only the hover trigger itself is currently anchor-scoped.

## 3. Home page pacing (conservative pass)

- `.section`'s padding: `4.5rem 0` → `3.5rem 0`.
- The bento/reviews `.section` (currently plain, inherits `--bg`) and the lead-magnet `.section` (currently `background: var(--bg-elevated)` set inline) already alternate — this spec just confirms/keeps that alternation rather than inventing new background rules, since it's already correct, just not documented as deliberate.
- Explicitly out of scope: `hero-clinico`, `method-pin`, `split-section` (×2), `dna-banner` — these keep their current spacing; shrinking them requires visual iteration in a browser, not a blind CSS guess.

## 4. "Próximamente" placeholder cards

One placeholder card each in `blog/index.html`'s grid and `suplementos/index.html`'s grid (rendered as a plain static `<div>` in the blog HTML; for suplementos, appended after the dynamic Supabase-driven cards render, inside `renderCard`'s caller, not editable via `renderCard` itself since that function maps one row at a time). Per the audit's markup: `opacity: 0.4`, `pointer-events: none`, a "Próximamente" badge.

## 5. Lead-magnet value bullets

Add a new shared `.lead-benefits` class to `assets/style.css` (same checkmark-list visual as `.price-features`, generalized out of `precios/index.html`'s local `<style>` block so it's reusable). Add the 3-bullet `<ul>` to the home page's lead-magnet section (`index.html`, the "Descarga gratis el Protocolo de frío" form), copy per the audit.

## Testing

Same as Block 1: no automated UI tests in this repo; a Node syntax-check pass (`new Function(script)` per inline `<script>` block, same ad hoc check used in Block 1) plus manual browser verification at desktop and ≤720px, plus a reminder that none of this is live until Mario redeploys to Netlify.
