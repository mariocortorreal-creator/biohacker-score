# Visual Audit Fixes Block 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5 remaining audit items that need no data or design decision from Mario first: a "Más elegido" pricing badge, working hover on all card variants, a conservative home-page pacing pass, "Próximamente" placeholder cards on blog/suplementos, and lead-magnet value bullets.

**Architecture:** All 5 items live in `biohackerlatino-web` only (no git, manual Netlify deploy, no build, no templating across its 10 hand-authored HTML pages).

**Tech Stack:** Plain HTML/CSS/JS, shared `assets/style.css`, no new dependencies.

## Global Constraints

- No git in this repo — every task ends in manual browser verification, and Mario must redeploy to Netlify before any of this is live.
- `assets/style.css` is shared by all 10 pages. Task 2 (card hover) and Task 3 (section padding) both edit shared rules (`.card`, `.section`), so their effects apply **site-wide**, not just to the pages the audit called out — this is intentional (less dead vertical space and working hover everywhere is a net improvement), not scope creep, but worth knowing before touching those selectors.
- Per the paired design spec (`docs/superpowers/specs/2026-07-17-visual-audit-fixes-block2-design.md`), two claims in the source audit document were confirmed stale: blog/suplementos already have 5 items each (not "un solo artículo"), and `a.card:hover` already exists for anchor cards. Do not "fix" things that already work — see each task for the precise, narrower real gap.
- Do not touch the 3 deferred items (social proof, mito/verdad thumbnails, gold/mitochondria aesthetic direction) — out of scope for this plan.

---

### Task 1: "Más elegido" badge on the Pro pricing tier

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\precios\index.html` (local `<style>` block, currently lines 30-81; `renderCard`, currently lines 175-193)

**Interfaces:** None — self-contained.

- [ ] **Step 1: Add the featured-card CSS**

Find (currently lines 75-80, the end of the page's local `<style>` block):

```css
  .coach-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.3rem;
    color: var(--accent);
    margin: 0.5rem 0 1rem;
  }
</style>
```

Replace with:

```css
  .coach-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.3rem;
    color: var(--accent);
    margin: 0.5rem 0 1rem;
  }
  .price-card.featured {
    position: relative;
    border-color: var(--accent);
    transform: scale(1.03);
  }
  .badge-featured {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
  }
  @media (hover: hover) and (pointer: fine) {
    .price-card.featured:hover { transform: translateY(-4px) scale(1.03); }
  }
</style>
```

(The extra `:hover` override keeps the 1.03 scale from Task 1 and the `-4px` lift from Task 2's card hover working together — without it, hovering the featured card would replace the scale with the plain lift, since CSS `transform` doesn't combine across two separate rules automatically.)

- [ ] **Step 2: Mark the Pro card as featured in `renderCard`**

Find (currently lines 175-193):

```js
function renderCard(p) {
  const link = CLIENT_PLAN_LINKS[p.tier];
  const price = Number(p.price_usd).toFixed(2);
  const quota = p.monthly_diet_quota;
  return `
    <div class="card price-card">
      <span class="badge">Cliente</span>
      <div class="card-title">${escapeHtml(p.display_name)}</div>
      <div class="price-amount">$${price}<span>/mes</span></div>
      <ul class="price-features">
        <li>Score diario y recomendaciones por categoría</li>
        <li>Protocolos de 7 días personalizados</li>
        <li>${quota} ${quota === 1 ? "dieta generada por IA" : "dietas generadas por IA"} al mes</li>
        <li>Exportación de datos</li>
      </ul>
      ${link ? `<a class="btn btn-warm" href="${link}?client_reference_id=web" onclick="if(typeof gtag==='function')gtag('event','click_pricing',{tier:'${p.tier}'})">Suscribirme</a>` : ""}
    </div>
  `;
}
```

Replace with:

```js
function renderCard(p) {
  const link = CLIENT_PLAN_LINKS[p.tier];
  const price = Number(p.price_usd).toFixed(2);
  const quota = p.monthly_diet_quota;
  const isFeatured = p.tier === "pro";
  return `
    <div class="card price-card${isFeatured ? " featured" : ""}">
      ${isFeatured ? `<span class="badge-featured">Más elegido</span>` : ""}
      <span class="badge">Cliente</span>
      <div class="card-title">${escapeHtml(p.display_name)}</div>
      <div class="price-amount">$${price}<span>/mes</span></div>
      <ul class="price-features">
        <li>Score diario y recomendaciones por categoría</li>
        <li>Protocolos de 7 días personalizados</li>
        <li>${quota} ${quota === 1 ? "dieta generada por IA" : "dietas generadas por IA"} al mes</li>
        <li>Exportación de datos</li>
      </ul>
      ${link ? `<a class="btn btn-warm" href="${link}?client_reference_id=web" onclick="if(typeof gtag==='function')gtag('event','click_pricing',{tier:'${p.tier}'})">Suscribirme</a>` : ""}
    </div>
  `;
}
```

(Matches by `p.tier === "pro"`, not array position — `subscription_plans` is fetched sorted by `price_usd.asc`, and tier order isn't guaranteed to stay basico/pro/elite forever.)

- [ ] **Step 3: Manual verification**

Open `precios/index.html` in a browser (served, not `file://`, it fetches from Supabase): confirm the Pro card shows the "Más elegido" badge centered above it, is slightly larger and has a cyan border, and confirm hovering it lifts + keeps the scale (no visual "snap" where the scale disappears).

---

### Task 2: Card hover for non-anchor cards

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css:406-412`

**Interfaces:** None — self-contained. (Task 1's `.price-card.featured:hover` override depends on this task's broadened selector actually applying to `.price-card` — do this task first, or in the same pass, if executing out of order.)

- [ ] **Step 1: Broaden the existing hover rule**

Find (currently lines 406-412):

```css
@media (hover: hover) and (pointer: fine) {
  a.card:hover {
    transform: translateY(-4px);
    border-color: rgba(61, 220, 255, 0.35);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(61, 220, 255, 0.1), inset 0 1px 0 var(--glass-highlight);
  }
}
```

Replace with:

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover {
    transform: translateY(-4px);
    border-color: rgba(61, 220, 255, 0.35);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(61, 220, 255, 0.1), inset 0 1px 0 var(--glass-highlight);
  }
}
```

(Dropped the `a` prefix — the transition properties are already declared on the shared `.card` base rule at line 403, so this one-word change is enough to light up hover on every `.card`-based div too: supplement review cards, pricing cards, and the new placeholder cards from Task 4.)

- [ ] **Step 2: Manual verification**

At desktop width (hover-capable pointer), check `suplementos/index.html` and `precios/index.html`: confirm hovering any card (not just blog's `<a class="card">` links) now lifts slightly with a brighter border. Confirm nothing regressed on blog cards. Confirm touch devices (or DevTools mobile emulation) show no "stuck" hover state after a tap, since the `@media (hover: hover)` wrapper is unchanged.

---

### Task 3: Home page pacing (conservative pass)

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css:96-100`

**Interfaces:** None — self-contained.

**Confirmed scope (see design spec):** only 2 of the home page's 7 `<section>` elements use the generic `.section` class this task touches — the "Mito contra verdad" bento section and the final lead-magnet section. They are **not adjacent** to each other (the bespoke `dna-banner` section sits between them), so no background-alternation rule is needed on top of what already exists (`background: var(--bg-elevated)` is already set inline on the lead-magnet section) — reducing the padding is the only real change here. `hero-clinico`, `method-pin`, `split-section` ×2, and `dna-banner` keep their current spacing untouched, since shrinking those needs visual iteration in a browser, not a blind guess.

- [ ] **Step 1: Reduce `.section` padding**

Find (currently lines 96-100):

```css
.section {
  padding: 4.5rem 0;
  position: relative;
  z-index: 1;
}
```

Replace with:

```css
.section {
  padding: 3.5rem 0;
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 2: Manual verification**

Because `.section` is shared, check this doesn't just affect the home page: load `index.html`, `blog/index.html`, `suplementos/index.html`, `precios/index.html`, and `privacidad/index.html` at desktop width, confirm every page still reads cleanly with the reduced spacing (nothing overlapping, no section feeling cramped) rather than checking only the home page. This is a deliberately conservative 1rem reduction (16px per edge, 32px per section) — if it still feels too spaced out after seeing it live, that's expected; the rest of the home-length finding was explicitly deferred to a session where the bespoke sections can be iterated on visually.

---

### Task 4: "Próximamente" placeholder cards

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\blog\index.html:88-95` (static grid — insert a literal HTML card)
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\suplementos\index.html:132-184` (dynamic grid — insert a constant + append it after the fetched cards)

**Interfaces:** Depends on Task 2 being done first (or in the same pass) for the placeholder cards to get the new hover treatment too — not required for correctness, since `pointer-events: none` on the placeholder means hover is inert either way, but do Task 2 first for consistency if executing sequentially.

**Confirmed scope:** exactly 1 placeholder per grid (5 items in a 3-column `auto-fit` grid leaves exactly 1 empty slot in row 2 — not the larger gap the audit's stale framing implied).

- [ ] **Step 1: Add the blog placeholder card**

Find (currently lines 88-94, the last real article card, immediately before the grid's closing `</div>`):

```html
      <a class='card' href='/blog/ayuno-intermitente-ciencia-real'>
        <div class="card-thumb"><img src="/assets/blog/ayuno-intermitente.jpg" alt="" loading="lazy" width="400" height="225"></div>
        <span class="badge">Nutrición</span>
        <div class="card-title">Ayuno intermitente: la ciencia real detrás de la moda (y lo que nadie te dice)</div>
        <p class="card-excerpt">Qué dice la evidencia sobre sensibilidad a la insulina y autofagia, los mitos que hay que dejar ir, y cómo saber si de verdad te está funcionando.</p>
        <div class="card-meta">7 julio 2026</div>
      </a>
    </div>
  </div>
</section>
```

Replace with:

```html
      <a class='card' href='/blog/ayuno-intermitente-ciencia-real'>
        <div class="card-thumb"><img src="/assets/blog/ayuno-intermitente.jpg" alt="" loading="lazy" width="400" height="225"></div>
        <span class="badge">Nutrición</span>
        <div class="card-title">Ayuno intermitente: la ciencia real detrás de la moda (y lo que nadie te dice)</div>
        <p class="card-excerpt">Qué dice la evidencia sobre sensibilidad a la insulina y autofagia, los mitos que hay que dejar ir, y cómo saber si de verdad te está funcionando.</p>
        <div class="card-meta">7 julio 2026</div>
      </a>
      <div class="card" style="opacity:.4; pointer-events:none;">
        <span class="badge">Próximamente</span>
        <div class="card-title">Nuevo artículo cada semana</div>
        <p class="card-excerpt">Estamos preparando el próximo protocolo con evidencia real.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the suplementos placeholder card constant**

Find (currently lines 132-137, the start of `renderCard`):

```js
function renderCard(s) {
  const isStrong = s.evidence_tier === "strong";
  const tierLabel = isStrong ? "Evidencia fuerte" : "Evidencia moderada";
  const diff = DIFFERENTIATOR_BY_NAME[s.name];
  const image = IMAGE_BY_NAME[s.name];
  const icon = ICON_BY_NAME[s.name] || DEFAULT_ICON;
```

Insert immediately before it:

```js
const PLACEHOLDER_CARD = `
  <div class="card review-card" style="opacity:.4; pointer-events:none;">
    <span class="badge">Próximamente</span>
    <div class="card-title">Nuevo suplemento cada semana</div>
  </div>
`;

function renderCard(s) {
  const isStrong = s.evidence_tier === "strong";
  const tierLabel = isStrong ? "Evidencia fuerte" : "Evidencia moderada";
  const diff = DIFFERENTIATOR_BY_NAME[s.name];
  const image = IMAGE_BY_NAME[s.name];
  const icon = ICON_BY_NAME[s.name] || DEFAULT_ICON;
```

- [ ] **Step 3: Append the placeholder after the fetched cards**

Find (currently line 179, inside `loadSupplements`):

```js
    grid.innerHTML = data.map(renderCard).join("");
```

Replace with:

```js
    grid.innerHTML = data.map(renderCard).join("") + PLACEHOLDER_CARD;
```

(Only appended on the success path — the empty-data and error branches above it already show their own single message card and shouldn't also show a "Próximamente" card next to an error.)

- [ ] **Step 4: Manual verification**

Load `blog/index.html`: confirm 6 cards total (5 real + 1 dimmed "Próximamente"), the placeholder isn't clickable (no cursor change, no navigation on click). Load `suplementos/index.html` (served, fetches from Supabase): confirm the same — 5 real supplement cards + 1 dimmed placeholder, non-interactive. Confirm both grids now read as intentionally "6 items, one coming soon" rather than an uneven 5-item grid with a dangling gap.

---

### Task 5: Lead-magnet value bullets

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css` (append new shared `.lead-benefits` rule)
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\index.html:223-236` (lead-magnet section)

**Interfaces:** None — self-contained.

**Confirmed scope:** the checkmark-list visual this needs already exists as `.price-features`, but only inside `precios/index.html`'s local `<style>` block — not reusable from `index.html`. This task adds an equivalent shared class instead of duplicating the local one a second time.

- [ ] **Step 1: Add the shared `.lead-benefits` CSS**

Append to the end of `assets\style.css` (after Task 3's Block 1 `.sticky-cta` addition, if done in the same session):

```css
/* ---------- Lead-magnet value bullets ---------- */
.lead-benefits {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0 auto 1.5rem;
  max-width: 420px;
  text-align: left;
}
.lead-benefits li {
  font-size: 0.88rem;
  color: var(--text-dim);
  padding-left: 1.3rem;
  position: relative;
  line-height: 1.4;
}
.lead-benefits li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
}
```

(Same visual as `precios/index.html`'s local `.price-features` — checkmark prefix via `::before`, dim body text — but `max-width` + `margin: 0 auto` added since this list sits in a centered, narrower context on the home page rather than inside a full-width pricing card.)

- [ ] **Step 2: Add the bullets to the home page's lead-magnet section**

Find (currently lines 223-236):

```html
<section class="section" style="background:var(--bg-elevated); border-top:1px solid var(--line); border-bottom:1px solid var(--line);">
  <div class="container text-center">
    <div class="eyebrow" style="justify-content:center; width:100%;"><span class="dot"></span> Regalo</div>
    <h2>Descarga gratis el <span>Protocolo de frío</span> para principiantes</h2>
    <p class="sub" style="margin-bottom:2rem;">Una guía corta y accionable para empezar con exposición al frío sin errores de principiante. Directo a tu correo.</p>
    <form class="lead-magnet-form" data-source="lead_magnet_protocolo_frio_home">
      <div class="lead-magnet-row">
        <input type="email" name="email" placeholder="tu@correo.com" required>
        <button class="btn btn-primary" type="submit">Enviarme la guía</button>
      </div>
      <p class="lead-magnet-msg" aria-live="polite"></p>
    </form>
  </div>
</section>
```

Replace with:

```html
<section class="section" style="background:var(--bg-elevated); border-top:1px solid var(--line); border-bottom:1px solid var(--line);">
  <div class="container text-center">
    <div class="eyebrow" style="justify-content:center; width:100%;"><span class="dot"></span> Regalo</div>
    <h2>Descarga gratis el <span>Protocolo de frío</span> para principiantes</h2>
    <p class="sub" style="margin-bottom:1rem;">Una guía corta y accionable para empezar con exposición al frío sin errores de principiante. Directo a tu correo.</p>
    <ul class="lead-benefits">
      <li>Protocolo de 3 pasos, sin errores de principiante</li>
      <li>Cuánto tiempo y a qué temperatura, con fuente</li>
      <li>Directo a tu correo, sin spam</li>
    </ul>
    <form class="lead-magnet-form" data-source="lead_magnet_protocolo_frio_home">
      <div class="lead-magnet-row">
        <input type="email" name="email" placeholder="tu@correo.com" required>
        <button class="btn btn-primary" type="submit">Enviarme la guía</button>
      </div>
      <p class="lead-magnet-msg" aria-live="polite"></p>
    </form>
  </div>
</section>
```

(Reduced the intro paragraph's `margin-bottom` from `2rem` to `1rem` since the new bullet list now provides its own `margin: 0 auto 1.5rem` spacing before the form — keeps the total gap roughly the same instead of stacking both margins.)

- [ ] **Step 3: Manual verification**

Load `index.html`, scroll to the "Descarga gratis el Protocolo de frío" section: confirm the 3 checkmarked bullets appear between the intro paragraph and the email form, centered, readable at both desktop and ≤720px widths, and that the form still submits correctly (unrelated to this change, but confirm nothing broke — `lead-magnet.js` wasn't touched).

---

## Post-implementation

- [ ] **Syntax-check all 5 touched files**

```bash
cd "C:\Users\PC\Desktop\.claude\biohackerlatino-web"
node -e "
const fs = require('fs');
const files = ['index.html','blog/index.html','precios/index.html','suplementos/index.html'];
let ok = true;
files.forEach(f => {
  const html = fs.readFileSync(f, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((s, i) => {
    try { new Function(s); }
    catch (e) { ok = false; console.log(f, 'block', i, 'SYNTAX ERROR:', e.message); }
  });
});
console.log(ok ? 'ALL OK' : 'FAILURES ABOVE');
"
```

Expected: `ALL OK`.

- [ ] **Tell Mario to redeploy** `biohackerlatino-web` to Netlify — none of these 5 items are live until he does.

- [ ] **Update the `biohacker_score_status` project memory** to mark Block 2 complete, and confirm with Mario whether/when to brainstorm the 3 still-deferred items (social proof numbers, mito/verdad video thumbnails, gold/mitochondria aesthetic direction).
