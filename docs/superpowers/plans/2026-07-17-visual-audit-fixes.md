# Visual Audit Fixes (Top 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5 highest-priority fixes from Mario's external design/UX/marketing audit: a broken mobile nav, stuck 0% counters, a jarring app login screen, a missing sticky mobile CTA, and a missing video link on supplement cards.

**Architecture:** Two unrelated static/no-build codebases, touched independently per task. `biohackerlatino-web` is 10 hand-authored HTML pages (no templating, no build, no git — deploys via manual drag-to-Netlify) sharing one `assets/style.css`. `biohacker-score` is this repo's single `index.html` (React via `React.createElement`, no JSX/build) plus a Supabase Postgres backend reached through tracked SQL migrations.

**Tech Stack:** Plain HTML/CSS/JS + GSAP/ScrollTrigger (marketing site); React 18 UMD + Tailwind CDN + Supabase REST (app); Supabase Postgres migrations (`supabase/migrations/*.sql`).

## Global Constraints

- `biohackerlatino-web` has **no git and no test framework** — every task there ends in manual browser verification (desktop + ≤720px mobile viewport), and Mario must be told to redeploy to Netlify before changes are live (per this project's existing convention — local file edits are not live until he redeploys).
- `biohacker-score` **is** git-tracked and has `npm test` (Node's built-in test runner) — any task touching `index.html` must end with `npm test` passing, since one of those tests parses every inline `<script>` block for syntax errors (catches paren-mismatch bugs by design).
- Do not touch anything outside the 5 items below — the remaining 8 audit findings (pricing-card hierarchy, hover states, home length, social proof, gold/Elite accent, ring glow, macro-cards, mitochondria pulse) are explicitly out of scope, per `docs/superpowers/specs/2026-07-17-visual-audit-fixes-design.md`.
- `biohackerlatino-web` pages use **absolute** paths (`/blog/`, `/precios/`, etc.), not relative — preserve that convention in any new markup.
- Match existing code style exactly: `biohackerlatino-web` uses 2-space indentation in HTML/CSS; `biohacker-score`'s `index.html` script block is single-quoted, non-JSX `React.createElement` calls (see `CLAUDE.md` for why — it's compiled/transpiled output, not hand-JSX).

---

### Task 1: Fix stuck 0%/0 counters on mobile

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\index.html:349-367` (`.ev-stat` counters, mobile IntersectionObserver path)
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\index.html:405-418` (score-ring `ringObserver`)

**Interfaces:** None — self-contained, no dependency on other tasks.

**Root cause (confirmed by reading the code, not assumed):** `if (isDesktop)` gates a GSAP ScrollTrigger path (works correctly) vs. an `else` branch using `new IntersectionObserver(..., { threshold: 0.4 })` for everyone else (mobile/tablet). At `threshold: 0.4`, a fast mobile scroll can carry the element past 40%-visible before the observer's callback fires even once, leaving `.ev-stat` stuck at its initial `0%` text and the score ring stuck at `0`. The same `{ threshold: 0.4 }` bug is duplicated in the separate `ringObserver` for the phone-mock score ring.

- [ ] **Step 1: Lower the threshold and add a fallback timer for the `.ev-stat` counters**

Open `index.html`, find this block (currently lines 349-367):

```js
  } else {
    document.querySelectorAll('.ev-card').forEach(card => {
      const statEl = card.querySelector('.ev-stat');
      const val = parseFloat(statEl.dataset.value);
      const decimals = parseInt(statEl.dataset.decimals || '0');
      const prefix = statEl.dataset.prefix || '';
      const suffix = statEl.dataset.suffix || '';
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          const c = { v: 0 };
          gsap.to(c, { v: val, duration: 1.1, ease: 'power2.out',
            onUpdate: () => statEl.textContent = prefix + c.v.toFixed(decimals) + suffix });
        });
      }, { threshold: 0.4 });
      obs.observe(card);
    });
  }
```

Replace it with:

```js
  } else {
    document.querySelectorAll('.ev-card').forEach(card => {
      const statEl = card.querySelector('.ev-stat');
      const val = parseFloat(statEl.dataset.value);
      const decimals = parseInt(statEl.dataset.decimals || '0');
      const prefix = statEl.dataset.prefix || '';
      const suffix = statEl.dataset.suffix || '';
      const finalText = prefix + val.toFixed(decimals) + suffix;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          const c = { v: 0 };
          gsap.to(c, { v: val, duration: 1.1, ease: 'power2.out',
            onUpdate: () => statEl.textContent = prefix + c.v.toFixed(decimals) + suffix });
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
      obs.observe(card);
      // Fallback: a very fast scroll (or prefers-reduced-motion, which GSAP still
      // respects for the tween itself) can carry the card past the observer's
      // trigger zone without ever firing. If that happens, force the final value
      // after 3s instead of leaving the counter stuck at its initial 0%/0.
      setTimeout(() => {
        if (statEl.textContent === finalText) return;
        if (statEl.textContent === prefix + (0).toFixed(decimals) + suffix) {
          statEl.textContent = finalText;
        }
      }, 3000);
    });
  }
```

- [ ] **Step 2: Apply the same threshold/rootMargin fix to the score-ring observer**

Find this block (currently lines 405-418):

```js
/* Score ring animation (phone mockup) */
const ringObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    ringObserver.unobserve(entry.target);
    gsap.to('#seg-1', { strokeDasharray: '270 440', duration: 1, ease: 'power2.out' });
    gsap.to('#seg-2', { strokeDasharray: '100 440', strokeDashoffset: -270, duration: 1, ease: 'power2.out', delay: .1 });
    const c = { v: 0 };
    gsap.to(c, { v: 74, duration: 1.3, ease: 'power2.out', onUpdate: () => document.getElementById('score-a').textContent = Math.round(c.v) });
    gsap.from('.phone-metric', { opacity: 0, y: 10, duration: .5, stagger: .08, delay: .3 });
  });
}, { threshold: 0.4 });
const phoneEl = document.querySelector('.phone-mock');
if (phoneEl) ringObserver.observe(phoneEl);
```

Replace it with:

```js
/* Score ring animation (phone mockup) */
const ringObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    ringObserver.unobserve(entry.target);
    gsap.to('#seg-1', { strokeDasharray: '270 440', duration: 1, ease: 'power2.out' });
    gsap.to('#seg-2', { strokeDasharray: '100 440', strokeDashoffset: -270, duration: 1, ease: 'power2.out', delay: .1 });
    const c = { v: 0 };
    gsap.to(c, { v: 74, duration: 1.3, ease: 'power2.out', onUpdate: () => document.getElementById('score-a').textContent = Math.round(c.v) });
    gsap.from('.phone-metric', { opacity: 0, y: 10, duration: .5, stagger: .08, delay: .3 });
  });
}, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
const phoneEl = document.querySelector('.phone-mock');
if (phoneEl) {
  ringObserver.observe(phoneEl);
  // Same fast-scroll fallback as the .ev-stat counters above.
  setTimeout(() => {
    const scoreEl = document.getElementById('score-a');
    if (scoreEl && scoreEl.textContent === '0') {
      scoreEl.textContent = '74';
      document.getElementById('seg-1')?.setAttribute('stroke-dasharray', '270 440');
      document.getElementById('seg-2')?.setAttribute('stroke-dasharray', '100 440');
      document.getElementById('seg-2')?.setAttribute('stroke-dashoffset', '-270');
    }
  }, 3000);
}
```

- [ ] **Step 3: Manual verification**

Serve the folder locally (`npx serve C:\Users\PC\Desktop\.claude\biohackerlatino-web`, or open `index.html` directly) and, using real Chrome DevTools device emulation at a mobile width (390px) with throttled/fast scrolling, confirm:
- The 4 stat cards ("+250%", "-63%", "-27.9%", "+13.9%") animate to their real values, not stuck at `0%`.
- The phone-mock score ring animates to `74` with both ring segments drawn.
- Force-testing the fallback: temporarily set `setTimeout(..., 3000)` to `setTimeout(..., 50)` in a scratch copy, confirm the fallback fires and sets the correct final text, then revert (do not ship the shortened delay).

- [ ] **Step 4: Tell Mario to redeploy**

This repo has no git/CI. State explicitly to Mario that `index.html` changed locally and needs a manual redeploy to Netlify before it's live — do not assume the fix is live just because the file changed.

---

### Task 2: Add a working mobile nav menu (10 pages)

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css` (shared — one edit covers all 10 pages)
- Modify (button + script, one insertion each): `index.html`, `blog\index.html`, `blog\ayuno-intermitente-ciencia-real.html`, `blog\cafeina-l-teanina-enfoque-sin-el-bajon.html`, `blog\creatina-no-es-solo-para-el-gimnasio.html`, `blog\exposicion-al-frio-protocolo-real.html`, `blog\magnesio-para-dormir-cual-funciona.html`, `precios\index.html`, `suplementos\index.html`, `privacidad\index.html`

**Interfaces:** None — self-contained. (Depends on nothing from Task 1/3, though Task 3 also edits `index.html` — no line overlap, safe to do in either order.)

**Root cause (confirmed):** `assets/style.css` already defines `.nav-toggle { display: none; }` and hides `.nav-links a:not(.btn)` under 720px, but no page's HTML contains a `.nav-toggle` button — so under 720px, Blog/Suplementos/Precios/YouTube become completely unreachable (only the header's CTA button survives).

- [ ] **Step 1: Add the toggle button + open-panel CSS**

In `assets\style.css`, find (currently lines 338-342):

```css
.nav-toggle { display: none; }

@media (max-width: 720px) {
  .nav-links a:not(.btn) { display: none; }
}
```

Replace with:

```css
.nav-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 0.4rem;
}

@media (max-width: 720px) {
  .nav-toggle { display: block; }

  .nav-links {
    position: fixed;
    inset: 0;
    z-index: 15;
    background: var(--bg);
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 0;
    padding: 6.5rem 2rem 2rem;
    transform: translateY(-12px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
  }

  .nav-links.open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .nav-links a:not(.btn) {
    display: block;
    font-size: 1.1rem;
    padding: 0.75rem 0;
  }

  .nav-links .btn {
    margin-top: 1rem;
  }
}
```

(`z-index: 15` stays below `.site-header`'s `z-index: 20`, so the sticky header — and the now-visible toggle button in it — remains clickable on top of the open panel, letting the user close the menu without hunting for a separate close button. `inset: 0` + `padding: 6.5rem ...` clears the header's real rendered height (~68px) with margin to spare, instead of hardcoding a brittle pixel offset.)

- [ ] **Step 2: Add the hamburger button to all 10 pages**

For each file below, find the exact CTA line (unique per file — includes its own `utm_campaign` value) followed by `</nav>`, `</div>`, `</header>`, and insert the `<button class="nav-toggle">` between `</nav>` and `</div>`.

**`index.html`** — find:
```html
      <a class="btn btn-primary btn-sm magnetic" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=web_home_nav" onclick="if(typeof gtag==='function')gtag('event','click_cta',{ref:'web_home_nav'})">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm magnetic" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=web_home_nav" onclick="if(typeof gtag==='function')gtag('event','click_cta',{ref:'web_home_nav'})">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\index.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=blog_listing">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=blog_listing">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\ayuno-intermitente-ciencia-real.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_ayuno_intermitente">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_ayuno_intermitente">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\cafeina-l-teanina-enfoque-sin-el-bajon.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_cafeina">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_cafeina">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\creatina-no-es-solo-para-el-gimnasio.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_creatina">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_creatina">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\exposicion-al-frio-protocolo-real.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_frio">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_frio">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`blog\magnesio-para-dormir-cual-funciona.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_magnesio">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=post_magnesio">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`precios\index.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=precios">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=precios">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`suplementos\index.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=suplementos">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=suplementos">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

**`privacidad\index.html`** — find:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=privacidad">Entra a tu Score</a>
    </nav>
  </div>
</header>
```
replace with:
```html
      <a class="btn btn-primary btn-sm" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=privacidad">Entra a tu Score</a>
    </nav>
    <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
```

- [ ] **Step 3: Add the toggle script to all 10 pages**

In each of the 10 files, find the closing:
```html
</body>
</html>
```
and replace with:
```html
<script>
document.querySelector('.nav-toggle').addEventListener('click', function () {
  document.querySelector('.nav-links').classList.toggle('open');
  this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
});
</script>
</body>
</html>
```

(This is the exact same 6-line snippet in all 10 files — each page's `.nav-toggle`/`.nav-links` are scoped to that page's own DOM, so no cross-page state or shared module is needed.)

- [ ] **Step 4: Manual verification**

At ≤720px width, on **every one of the 10 pages**: confirm the hamburger button appears, clicking it slides down a full-screen panel with all 4 links + the CTA button, all links are clickable and navigate correctly, clicking the button again closes the panel, and `aria-expanded` toggles between `"false"`/`"true"` (inspect via DevTools). Also confirm nothing regressed at ≥721px (desktop nav still shows inline, no hamburger visible).

- [ ] **Step 5: Tell Mario to redeploy**

Same as Task 1 — no git/CI on this repo, changes need a manual Netlify redeploy.

---

### Task 3: Sticky mobile CTA bar (home page only)

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css` (append new rule block — does not touch Task 2's edited lines, safe to do in either order relative to Task 2)
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\index.html` (add markup before the footer's closing `<script>` tags, add JS in the existing trailing `<script>` block)

**Interfaces:** None — self-contained.

- [ ] **Step 1: Add the `.sticky-cta` CSS**

Append to the end of `assets\style.css`:

```css
/* ---------- Sticky mobile CTA ---------- */
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem 1rem;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--line);
  transform: translateY(100%);
  transition: transform 0.3s var(--ease-out);
  z-index: 50;
  display: none;
}

@media (max-width: 720px) {
  .sticky-cta { display: block; }
  .sticky-cta.visible { transform: translateY(0); }
  .sticky-cta .btn { width: 100%; }
}
```

(`display: none` above 720px, matching how the rest of this site scopes mobile-only UI — no JS feature-detection needed, the CSS media query already gates it.)

- [ ] **Step 2: Add the sticky bar markup to `index.html`**

Find (the end of the footer, currently lines 247-249):

```html
</footer>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
```

Replace with:

```html
</footer>

<div class="sticky-cta" id="stickyCta">
  <a class="btn btn-primary magnetic" href="https://app.biohackerlatino.com/registro?utm_source=blog&utm_medium=web&utm_campaign=web_home_sticky" onclick="if(typeof gtag==='function')gtag('event','click_cta',{ref:'web_home_sticky'})">Prueba tu Score gratis 10 días</a>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
```

(New `ref: 'web_home_sticky'` value follows this page's existing `click_cta` GA4 convention — `web_home_nav`/`web_home_hero`/`web_home_mid`/`web_home_footer` already exist, so this is trackable as its own funnel step from day one, not lumped in with the others.)

- [ ] **Step 3: Add the visibility-toggle JS**

Find the very end of the trailing `<script>` block (currently lines 417-419):

```js
const phoneEl = document.querySelector('.phone-mock');
if (phoneEl) ringObserver.observe(phoneEl);
</script>
```

Replace with:

```js
const phoneEl = document.querySelector('.phone-mock');
if (phoneEl) ringObserver.observe(phoneEl);

/* Sticky mobile CTA: visible once the hero scrolls out of view */
const stickyCta = document.getElementById('stickyCta');
const heroEl = document.querySelector('.hero-clinico');
if (stickyCta && heroEl) {
  new IntersectionObserver(([entry]) => {
    stickyCta.classList.toggle('visible', !entry.isIntersecting);
  }).observe(heroEl);
}
</script>
```

(Uses `.hero-clinico`, this page's actual hero class — the audit document's example used a generic `.hero` selector that doesn't exist here.)

- [ ] **Step 4: Manual verification**

At ≤720px width: confirm the bar is invisible while the hero is on screen, slides up into view once you scroll past the hero, stays fixed at the bottom while scrolling the rest of the page, and its button navigates to the registro URL with `utm_campaign=web_home_sticky`. Confirm it's completely absent (no bar, no layout shift) at ≥721px.

- [ ] **Step 5: Tell Mario to redeploy**

Same as Tasks 1-2.

---

### Task 4: App auth-screen visual parity + app-wide background unification

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html:54` (add `useRef` to the existing destructure)
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html` (insert new `initAuthParticles` helper after the config-constants block, currently ending at line 83)
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html` (`AuthScreen`, currently starting at line 594)
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html` (global hex swap `#0A0E14` → `#060809`, all occurrences)
- Test: `npm test` (existing suite, no new test files — the syntax-check test already covers this)

**Interfaces:** None — self-contained within this one file.

**Confirmed before writing this task:** `useRef` is not currently imported (`const { useState, useEffect, useMemo } = React;` at line 54); `#0A0E14` appears dozens of times across this file, including inside Tailwind arbitrary-value classes with opacity modifiers (`bg-[#0A0E14]/70`, `bg-[#0A0E14]/90`) — a plain substring replace of the 7-character hex code handles all of them since it's the hex itself changing, not the surrounding class syntax.

- [ ] **Step 1: Add `useRef` to the React destructure**

Find (line 54):

```js
const { useState, useEffect, useMemo } = React;
```

Replace with:

```js
const { useState, useEffect, useMemo, useRef } = React;
```

- [ ] **Step 2: Add the `initAuthParticles` helper**

Find the end of the config-constants block (currently line 83):

```js
const HEALTH_PERMISSIONS = ["READ_STEPS", "READ_WORKOUTS", "READ_ACTIVE_CALORIES"];
```

Insert immediately after it (before the `// ---------- Icons` comment):

```js
const HEALTH_PERMISSIONS = ["READ_STEPS", "READ_WORKOUTS", "READ_ACTIVE_CALORIES"];
const reduceMotion = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// ---------- Auth-screen ambient particles ----------
// Ported from biohackerlatino-web/index.html's initParticles (same visual: a handful of
// slow-drifting cyan dots on a canvas) so the login/signup screen doesn't look like a
// "blank drop" after the marketing site's hero. Unlike the marketing site (a static page
// where this canvas never unmounts), AuthScreen unmounts as soon as the user logs in — so
// this version returns a cleanup function that cancels the animation frame and removes the
// resize listener, called from AuthScreen's useEffect below. Skipping that cleanup would
// leak a running rAF loop + a window resize listener for the lifetime of the app after
// every login.
function initAuthParticles(canvas, count) {
    if (reduceMotion || !canvas) return () => {};
    const ctx = canvas.getContext("2d");
    let w, h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    function size() {
        w = parent.offsetWidth;
        h = parent.offsetHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener("resize", size);
    const dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.6,
        dx: (Math.random() - 0.5) * 0.12,
        dy: (Math.random() - 0.5) * 0.12,
        o: Math.random() * 0.4 + 0.15,
    }));
    let rafId;
    function frame() {
        ctx.clearRect(0, 0, w, h);
        dots.forEach((d) => {
            d.x += d.dx;
            d.y += d.dy;
            if (d.x < 0) d.x = w;
            if (d.x > w) d.x = 0;
            if (d.y < 0) d.y = h;
            if (d.y > h) d.y = 0;
            ctx.beginPath();
            ctx.fillStyle = `rgba(61,220,255,${d.o})`;
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
        });
        rafId = requestAnimationFrame(frame);
    }
    frame();
    return () => {
        window.removeEventListener("resize", size);
        cancelAnimationFrame(rafId);
    };
}
```

- [ ] **Step 3: Wire the canvas + gradient into `AuthScreen`**

Find the `AuthScreen` function's state declarations (currently lines 594-602):

```js
function AuthScreen({ onAuthed }) {
    const startInSignup = typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/registro";
    const [mode, setMode] = useState(startInSignup ? "signup" : "login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
```

Replace with (adds one `useRef` + one `useEffect`, both new):

```js
function AuthScreen({ onAuthed }) {
    const startInSignup = typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/registro";
    const [mode, setMode] = useState(startInSignup ? "signup" : "login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const particlesCanvasRef = useRef(null);
    useEffect(() => {
        return initAuthParticles(particlesCanvasRef.current, 46);
    }, []);
```

Then find the component's `return` (currently line 658):

```js
    return (React.createElement("div", { className: "min-h-screen bg-[#0A0E14] flex items-center justify-center px-6" },
        React.createElement("div", { className: "w-full max-w-sm" },
```

Replace with:

```js
    return (React.createElement("div", { className: "min-h-screen flex items-center justify-center px-6 relative overflow-hidden", style: { background: "radial-gradient(circle at 50% 20%, rgba(61,220,255,0.08), transparent 60%), #060809" } },
        React.createElement("canvas", { ref: particlesCanvasRef, className: "absolute inset-0 w-full h-full pointer-events-none", "aria-hidden": "true" }),
        React.createElement("div", { className: "w-full max-w-sm relative z-10" },
```

(The rest of `AuthScreen`'s JSX-via-`createElement` tree — the logo, the form card, the two buttons at the end — is unchanged; only the outer wrapping `div`'s className/style changed and one new sibling `<canvas>` + one extra level of nesting for the `relative z-10` content wrapper. Because this adds one opening paren via the new `React.createElement("div", ...,` wrapper and one new element as its first child, double-check the existing closing parens at the end of `AuthScreen` still balance — Step 5's `npm test` run (specifically the syntax-check test) will catch it if not.)

- [ ] **Step 4: Global hex swap `#0A0E14` → `#060809`**

Using a find-and-replace-all pass over `index.html` (not scoped to one function — this is deliberately app-wide, confirmed with Mario), replace every occurrence of the literal substring `#0A0E14` with `#060809`. This includes (non-exhaustive, confirmed present): the `body` rule inside the top `<style>` block, the `#boot-error` inline style, and every Tailwind arbitrary-value class using it (`bg-[#0A0E14]`, `bg-[#0A0E14]/70`, `bg-[#0A0E14]/90`, etc. across `Dashboard`, `CoachPanel`, form inputs, and more). Do **not** touch `#11161F` (panel) or `#1E2535` (border) — only the base background hex changes.

- [ ] **Step 5: Run the test suite**

```bash
cd C:\Users\PC\Desktop\.claude\biohacker-score
npm test
```

Expected: all 50 existing tests pass, in particular `every inline <script> block in index.html is syntactically valid JS` (the syntax-check test) — this is what actually catches a mismatched paren from Step 3's edit, since there's no bundler/TS in this file to catch it any other way.

- [ ] **Step 6: Manual verification in a browser**

Serve the app (e.g. `npx serve C:\Users\PC\Desktop\.claude\biohacker-score`) and open it logged out: confirm the login/signup screen now shows drifting particles + the radial gradient instead of a flat black screen, confirm the background reads as the same near-black as `biohackerlatino-web` (`#060809`) rather than the old `#0A0E14`. Log in, and spot-check the Dashboard and (if you have coach access) the coach panel still render correctly with the new background — nothing should look visually broken, since `#060809` and `#0A0E14` are very close in value.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add ambient particles to auth screen, unify app background with marketing site (#0A0E14 -> #060809)"
```

---

### Task 5: "Ver el análisis" video link on supplement cards

**Files:**
- Create: `C:\Users\PC\Desktop\.claude\biohacker-score\supabase\migrations\20260717120000_add_supplement_video_url_column.sql`
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\suplementos\index.html:132-155` (`renderCard`)

**Interfaces:**
- Produces: a nullable `video_url text` column on `public.supplement_recommendations`, read the same way `amazon_affiliate_url` already is (`s.video_url` on each row returned by the existing `GET {REST}/supplement_recommendations?select=*` call — no query change needed, `select=*` already includes new columns).

**Confirmed before writing this task:** `suplementos/index.html`'s `renderCard(s)` already renders `amazonLink` conditionally from `s.amazon_affiliate_url` (a DB column, not a hardcoded JS map) — `video_url` as a DB column matches this existing pattern more closely than the audit's suggested hardcoded `VIDEO_BY_NAME` object would. `.btn-outline` and `.btn-sm` already exist in `assets/style.css` (used elsewhere) — no new CSS needed.

- [ ] **Step 1: Add the migration**

Create `supabase\migrations\20260717120000_add_supplement_video_url_column.sql`:

```sql
-- Nullable YouTube link per supplement, rendered as a second "Ver el análisis" button on
-- biohackerlatino-web/suplementos/index.html next to the existing Amazon link
-- (amazon_affiliate_url on this same table). Null/absent means the button simply doesn't
-- render for that row — same non-event as a supplement currently missing a product photo.
alter table public.supplement_recommendations
  add column video_url text;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool against project `bciwxtjgabbnuxjxrwzt` with this file's contents. Per this project's history, `apply_migration` (schema DDL) has been blocked by the Claude Code auto-mode classifier before — if that happens, ask Mario to run the same SQL manually via the Supabase Studio SQL editor instead of retrying.

- [ ] **Step 3: Add the video button to `renderCard`**

Find (currently lines 141-143 of `suplementos\index.html`):

```js
  const amazonLink = s.amazon_affiliate_url
    ? `<a class="btn btn-warm" href="${escapeHtml(s.amazon_affiliate_url)}" target="_blank" rel="noopener noreferrer sponsored">Ver en Amazon</a>`
    : "";
```

Replace with:

```js
  const amazonLink = s.amazon_affiliate_url
    ? `<a class="btn btn-warm" href="${escapeHtml(s.amazon_affiliate_url)}" target="_blank" rel="noopener noreferrer sponsored">Ver en Amazon</a>`
    : "";
  const videoLink = s.video_url
    ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(s.video_url)}" target="_blank" rel="noopener noreferrer">▶ Ver el análisis</a>`
    : "";
```

Then find (currently line 153, inside the returned template string):

```js
        ${amazonLink}
```

Replace with:

```js
        ${amazonLink}
        ${videoLink}
```

- [ ] **Step 4: Load the real video URLs**

Mario supplies the YouTube URL for each of the 5 supplements (confirmed he has them, at least 4 of 5 — one may still be missing). For each URL he provides, run against project `bciwxtjgabbnuxjxrwzt`:

```sql
update public.supplement_recommendations
set video_url = '<the URL Mario provided>'
where name = '<exact supplement name, e.g. Creatina monohidratada>';
```

using the Supabase MCP `execute_sql` tool (this is a plain `UPDATE`, not DDL — not expected to hit the `apply_migration` classifier block). Any supplement without a URL yet keeps `video_url = null` and its card simply renders without the video button — no code change needed when Mario supplies the missing one later, just another `UPDATE`.

- [ ] **Step 5: Manual verification**

Open `suplementos/index.html` in a browser (served, not `file://`, since it fetches from Supabase) after Step 2 and at least one Step-4 update: confirm the supplement(s) with a `video_url` show both "Ver en Amazon" and "▶ Ver el análisis" buttons side by side, confirm the video link opens the correct YouTube URL in a new tab, and confirm a supplement with no `video_url` still renders correctly with only the Amazon button (no broken empty link, no layout shift).

- [ ] **Step 6: Tell Mario to redeploy** (for the `biohackerlatino-web` half only — the migration is already live once applied in Step 2)

---

## Post-implementation

Once all 5 tasks are done: update the `biohacker_score_status` project memory to mark this audit's Top-5 block complete, and confirm with Mario whether to brainstorm the remaining 8 deferred audit items (pricing-card hierarchy, hover states, home length/pacing, blog/suplementos placeholder cards, social proof, lead-magnet bullets, gold/Elite accent, ring glow, macro-cards, mitochondria pulse) as a follow-up spec.
