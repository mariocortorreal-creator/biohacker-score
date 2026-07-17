# Visual Audit Fixes Block 3 (Aesthetic Direction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the audit's "premium aesthetic direction" section: a gold accent for the Elite pricing tier, a glow pulse when the marketing site's demo score ring finishes animating, macro-split bars in the app's macro calculator, and a Three.js mitochondria replacing the app's session-restore spinner (with a mandatory fallback to that same spinner if Three.js/WebGL isn't available).

**Architecture:** Tasks 1-2 touch `biohackerlatino-web` (no git, manual Netlify deploy). Tasks 3-4 touch `biohacker-score` (git-tracked). No task depends on another — all 4 are independent and can be done in any order.

**Tech Stack:** Same as prior blocks (plain HTML/CSS/JS + GSAP on the marketing site; React 18 UMD + Tailwind CDN on the app), plus **one new dependency**: Three.js, loaded the same way React/ReactDOM already are — a pinned-version CDN `<script>` tag, no bundler, no ES modules.

## Global Constraints

- `biohackerlatino-web` has no git/tests — Tasks 1-2 end in manual browser verification + a reminder that Mario must redeploy to Netlify.
- `biohacker-score` has `npm test` (includes a syntax-check over every inline `<script>` block) — Tasks 3-4 must end with it passing.
- Task 4's fallback path (Three.js/WebGL unavailable → plain spinner) is not optional polish — it's the single most-repeated screen in the entire app (every session restore, every platform), so its manual verification step in Task 4 is mandatory, not skippable.
- Do not touch anything outside these 4 items — this closes out the full audit from `auditoria-diseno-ux-marketing.md` except the still-deferred social-proof strip (blocked on real numbers Mario hasn't decided on yet).

---

### Task 1: Gold accent for the Elite pricing tier

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\precios\index.html` (local `<style>` block, currently lines 30-101; `renderCard`, currently lines 195-213)

**Interfaces:** None — self-contained.

- [ ] **Step 1: Add the gold CSS variables and Elite card treatment**

Find (currently lines 98-100, the end of the local `<style>` block):

```css
  @media (hover: hover) and (pointer: fine) {
    .price-card.featured:hover { transform: translateY(-4px) scale(1.03); }
  }
</style>
```

Replace with:

```css
  @media (hover: hover) and (pointer: fine) {
    .price-card.featured:hover { transform: translateY(-4px) scale(1.03); }
  }
  .price-card.tier-elite {
    --gold: #D4AF37;
    --gold-dim: rgba(212, 175, 55, 0.14);
    border-color: var(--gold);
    background: linear-gradient(160deg, var(--gold-dim), var(--glass-bg));
  }
  .price-card.tier-elite .price-amount { color: var(--gold); }
</style>
```

(`--gold`/`--gold-dim` are scoped as custom properties on `.price-card.tier-elite` itself, not `:root` — this is the only place on the site gold appears, cyan stays the one accent everywhere else. `.price-amount { color: var(--gold) }` overrides that element's base `color: var(--text)` from line 38 only within an elite card, via specificity, no `!important` needed.)

- [ ] **Step 2: Mark the Elite card in `renderCard`**

Find (currently lines 195-202):

```js
function renderCard(p) {
  const link = CLIENT_PLAN_LINKS[p.tier];
  const price = Number(p.price_usd).toFixed(2);
  const quota = p.monthly_diet_quota;
  const isFeatured = p.tier === "pro";
  return `
    <div class="card price-card${isFeatured ? " featured" : ""}">
      ${isFeatured ? `<span class="badge-featured">Más elegido</span>` : ""}
```

Replace with:

```js
function renderCard(p) {
  const link = CLIENT_PLAN_LINKS[p.tier];
  const price = Number(p.price_usd).toFixed(2);
  const quota = p.monthly_diet_quota;
  const isFeatured = p.tier === "pro";
  const isElite = p.tier === "elite";
  return `
    <div class="card price-card${isFeatured ? " featured" : ""}${isElite ? " tier-elite" : ""}">
      ${isFeatured ? `<span class="badge-featured">Más elegido</span>` : ""}
```

- [ ] **Step 3: Manual verification**

Open `precios/index.html` in a browser (served, not `file://`): confirm the Elite card has a gold border, a subtle gold gradient wash, and its price is gold instead of white — while Básico stays the plain default look and Pro keeps last block's cyan "Más elegido" treatment (both untouched by this task). Confirm Elite and Pro's treatments don't visually clash if they ever needed to combine (they can't today — a plan can't be both `pro` and `elite` — but check the CSS specificity doesn't misbehave regardless).

---

### Task 2: Ring glow-on-complete

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\assets\style.css:866` (add a new keyframe + class near `.ring-wrap`)
- Modify: `C:\Users\PC\Desktop\.claude\biohackerlatino-web\index.html:446-471` (`ringObserver`, already touched in Block 1)

**Interfaces:** None — self-contained.

- [ ] **Step 1: Add the pulse keyframe CSS**

Find (currently line 866):

```css
.ring-wrap { position: relative; width: 140px; height: 140px; margin-bottom: 10px; filter: drop-shadow(0 0 16px var(--glow)); }
```

Replace with:

```css
.ring-wrap { position: relative; width: 140px; height: 140px; margin-bottom: 10px; filter: drop-shadow(0 0 16px var(--glow)); }
@keyframes ring-pulse {
  0%, 100% { filter: drop-shadow(0 0 16px var(--glow)); }
  50% { filter: drop-shadow(0 0 28px var(--glow)); }
}
.ring-wrap.complete { animation: ring-pulse 2.4s ease-in-out infinite; }
```

- [ ] **Step 2: Trigger the pulse when the score tween completes**

Find (currently lines 446-471):

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

Replace with:

```js
/* Score ring animation (phone mockup) */
const ringObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    ringObserver.unobserve(entry.target);
    gsap.to('#seg-1', { strokeDasharray: '270 440', duration: 1, ease: 'power2.out' });
    gsap.to('#seg-2', { strokeDasharray: '100 440', strokeDashoffset: -270, duration: 1, ease: 'power2.out', delay: .1 });
    const c = { v: 0 };
    gsap.to(c, {
      v: 74, duration: 1.3, ease: 'power2.out',
      onUpdate: () => document.getElementById('score-a').textContent = Math.round(c.v),
      onComplete: () => document.querySelector('.ring-wrap')?.classList.add('complete'),
    });
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
      document.querySelector('.ring-wrap')?.classList.add('complete');
    }
  }, 3000);
}
```

(Both paths — the normal tween completion and the 3s stuck-scroll fallback from Block 1 — now add `complete`, so the pulse fires reliably regardless of which path runs.)

- [ ] **Step 3: Manual verification**

Scroll the home page until the phone-mock score ring animates in: confirm that once the ring finishes drawing and the number settles on 74, the whole ring starts a slow, subtle pulsing glow that loops indefinitely (not a one-shot flash). Confirm it doesn't pulse before the animation completes.

---

### Task 3: Macro-split bars

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html:491-520` (`MacroCalculatorCard`)
- Test: `npm test`

**Interfaces:** None — self-contained.

**Deviates from a literal reading of the audit** (see design spec): protein/fat/carbs each get a bar showing their share of the day's total calories (grams × kcal-per-gram ÷ `targetKcal`), not a fake 0-100% "progress" bar — there's no separate current-vs-target pair for these values the way the daily Score has. Kcal itself has no bar (it's the total these three sum to).

- [ ] **Step 1: Add the macro-split bars**

Find (currently lines 499-513):

```js
    const results = macros && React.createElement(React.Fragment, null,
        React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3" },
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg text-slate-100" }, Math.round(macros.targetKcal)),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Kcal / día")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#7FE3A3" } }, Math.round(macros.proteinG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Proteína")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#FFC857" } }, Math.round(macros.fatG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Grasa")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#3DDCFF" } }, Math.round(macros.carbsG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Carbohidratos"))),
        React.createElement("div", { className: "text-[11px] text-slate-500 mt-3" }, `Objetivo: ${goalLabel}. Estimación inicial — ajusta según cómo se mueva tu peso en 2 semanas.`));
```

Replace with:

```js
    const macroBar = (kcalFromMacro, color) => React.createElement("div", { className: "h-1 rounded-full bg-[#1E2535] mt-1.5 overflow-hidden" },
        React.createElement("div", { className: "h-full rounded-full", style: { width: `${Math.min(100, Math.round((kcalFromMacro / macros.targetKcal) * 100))}%`, background: color } }));
    const results = macros && React.createElement(React.Fragment, null,
        React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3" },
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg text-slate-100" }, Math.round(macros.targetKcal)),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Kcal / día")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#7FE3A3" } }, Math.round(macros.proteinG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Proteína"),
                macroBar(macros.proteinG * 4, "#7FE3A3")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#FFC857" } }, Math.round(macros.fatG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Grasa"),
                macroBar(macros.fatG * 9, "#FFC857")),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "font-mono text-lg", style: { color: "#3DDCFF" } }, Math.round(macros.carbsG), "g"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-wider text-slate-500 mt-0.5" }, "Carbohidratos"),
                macroBar(macros.carbsG * 4, "#3DDCFF"))),
        React.createElement("div", { className: "text-[11px] text-slate-500 mt-3" }, `Objetivo: ${goalLabel}. Estimación inicial — ajusta según cómo se mueva tu peso en 2 semanas.`));
```

(`macroBar` takes the macro's own kcal contribution — grams × 4 for protein/carbs, × 9 for fat — and divides by `targetKcal` inside the helper, so each call site only needs to pass the raw kcal number, not a pre-computed percentage. `Math.min(100, ...)` guards against a bar overflowing its track if rounding ever pushes one macro's share fractionally over 100% on its own, e.g. from `Math.round` on all three independently not always summing to exactly 100.)

- [ ] **Step 2: Run the test suite**

```bash
cd C:\Users\PC\Desktop\.claude\biohacker-score
npm test
```

Expected: all 50 existing tests pass, including the syntax-check test.

- [ ] **Step 3: Manual verification**

In the app's Nutrición tab, enter a body weight and confirm the macro calculator now shows a thin colored bar under Proteína/Grasa/Carbohidratos (matching each value's existing color), each bar's length roughly proportional to how much of the day's total calories that macro represents — protein and carbs should generally be visually similar in bar length per gram (both 4 kcal/g) while fat's bar should look longer relative to its own gram count (9 kcal/g). Confirm Kcal/día has no bar under it.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add macro-split bars to the macro calculator card"
```

---

### Task 4: Mitochondria pulse (Three.js session-restore loading screen)

**Files:**
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html:19` (add the Three.js CDN `<script>` tag)
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html:141` (insert `hasWebGL`, `canMountMitoLoader`, `MitoLoader` after `initAuthParticles`)
- Modify: `C:\Users\PC\Desktop\.claude\biohacker-score\index.html` (`App`'s `restoring` render branch, currently line ~2123-2124 — line numbers shift after the Task 3 edit above, search by content instead)
- Test: `npm test`

**Interfaces:**
- Produces: `canMountMitoLoader` (boolean, computed once at script load), `MitoLoader` (a self-contained React component, no props) — consumed by `App`.

**Confirmed with Mario:** Three.js (not the audit's own lighter SVG+CSS recommendation), runs identically in the web build and the Capacitor-wrapped native app, with a **mandatory** automatic fallback to the existing `Loader2` spinner whenever Three.js fails to load or WebGL isn't available — checked before mounting the scene, never a try/catch around a failed render.

- [ ] **Step 1: Load Three.js via a pinned CDN script**

Find (currently line 19):

```html
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
```

Replace with:

```html
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

(A pinned, known-stable UMD build that exposes a global `THREE` — same "plain blocking `<script>` tag, no bundler" pattern already used for React/ReactDOM above it. **Before relying on this in later steps**, verify in a browser that the URL actually loads and `window.THREE` is defined — if the exact CDN path has moved since this plan was written, swap in a working mirror of the same r128 UMD build. This isn't a soft nice-to-have: Step 2 below builds the capability check specifically so that if this URL is ever wrong or unreachable, the app still falls back to the plain spinner automatically — but confirm the happy path works too, not just the fallback.)

- [ ] **Step 2: Add the capability check and `MitoLoader` component**

Find (currently lines 137-142):

```js
    frame();
    return () => {
        window.removeEventListener("resize", size);
        cancelAnimationFrame(rafId);
    };
}
// ---------- Icons (inline, no external icon lib) ----------
```

Insert immediately after it (before the Icons comment):

```js
    frame();
    return () => {
        window.removeEventListener("resize", size);
        cancelAnimationFrame(rafId);
    };
}
// ---------- Session-restore loading screen: mitochondria pulse ----------
// This is the single most-repeated screen in the app (every session restore, every
// platform), so a broken Three.js load must never leave the user with nothing visible.
// canMountMitoLoader is computed once, synchronously, from two checks: the CDN script
// actually defined `window.THREE` (it may not have — network failure, wrong URL, ad
// blocker), and this browser/WebView actually supports a WebGL context (a real gap on
// some older Android System WebViews). If either check fails, App renders the existing
// plain Loader2 spinner instead — exactly what it did before this feature existed.
function hasWebGL() {
    try {
        const canvas = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch (e) {
        return false;
    }
}
const canMountMitoLoader = typeof window !== "undefined" && typeof THREE !== "undefined" && hasWebGL();

function MitoLoader() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const size = 120;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size, size, false);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
        camera.position.z = 3;

        // Deformed icosahedron: an abstract organic pulse, not an anatomically literal
        // mitochondria render. detail=2 keeps this low-poly (~320 triangles) since it
        // renders on every app open, including on older Android WebViews.
        const geometry = new THREE.IcosahedronGeometry(1, 2);
        const posAttr = geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            const noise = Math.sin(v.x * 4) * Math.cos(v.y * 4) * Math.sin(v.z * 4) * 0.15;
            v.normalize().multiplyScalar(1 + noise);
            posAttr.setXYZ(i, v.x, v.y, v.z);
        }
        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            color: 0x0c2b33,
            emissive: 0x3ddcff,
            emissiveIntensity: 0.6,
            metalness: 0.2,
            roughness: 0.4,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        scene.add(new THREE.AmbientLight(0x3ddcff, 0.3));
        const pointLight = new THREE.PointLight(0x3ddcff, 1.2);
        pointLight.position.set(2, 2, 2);
        scene.add(pointLight);

        const clock = new THREE.Clock();
        let rafId;
        function animate() {
            const t = clock.getElapsedTime();
            mesh.rotation.y = t * 0.4;
            mesh.rotation.x = Math.sin(t * 0.3) * 0.15;
            material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.35;
            renderer.render(scene, camera);
            rafId = requestAnimationFrame(animate);
        }
        animate();

        // Same cleanup discipline as initAuthParticles above: this screen unmounts as
        // soon as session restore finishes, which can be near-instant, so an
        // uncancelled rAF loop + undisposed WebGL resources would otherwise leak on
        // every single app open.
        return () => {
            cancelAnimationFrame(rafId);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);
    return React.createElement("canvas", { ref: canvasRef, width: 120, height: 120, style: { width: 120, height: 120 } });
}
// ---------- Icons (inline, no external icon lib) ----------
```

- [ ] **Step 3: Use `MitoLoader` in `App`'s restoring branch**

Find (search by content — line number shifted by Task 3's edit):

```js
    return (React.createElement(React.Fragment, null, restoring ? (React.createElement("div", { className: "min-h-screen bg-[#060809] flex items-center justify-center" },
        React.createElement(Loader2, { size: 22, className: "animate-spin text-[#3DDCFF]" }))) : !session ? (React.createElement(AuthScreen, { onAuthed: handleAuthed })) : (React.createElement(Dashboard, { session: session, onLogout: handleLogout, onRefreshSession: async () => {
```

Replace with:

```js
    return (React.createElement(React.Fragment, null, restoring ? (React.createElement("div", { className: "min-h-screen bg-[#060809] flex items-center justify-center" },
        canMountMitoLoader ? React.createElement(MitoLoader, null) : React.createElement(Loader2, { size: 22, className: "animate-spin text-[#3DDCFF]" }))) : !session ? (React.createElement(AuthScreen, { onAuthed: handleAuthed })) : (React.createElement(Dashboard, { session: session, onLogout: handleLogout, onRefreshSession: async () => {
```

- [ ] **Step 4: Run the test suite**

```bash
cd C:\Users\PC\Desktop\.claude\biohacker-score
npm test
```

Expected: all 50 existing tests pass, including the syntax-check test — this is the step that actually catches a mismatched paren from Steps 2-3's edits.

- [ ] **Step 5: Manual verification — happy path**

Serve the app and reload it while logged in (so `restoring` briefly renders before session restore resolves): confirm a small pulsing, rotating cyan blob renders instead of the plain spinner, confirm it disappears cleanly once restore finishes with no visual artifact or console error, and confirm no console warnings about undisposed WebGL context on repeated reloads (open DevTools, reload several times in a row).

- [ ] **Step 6: Manual verification — fallback path (mandatory, not optional)**

Temporarily break the Three.js load to confirm the fallback actually works, then revert:
1. In a scratch copy or via DevTools request-blocking, prevent `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` from loading (e.g. Chrome DevTools → Network → block request URL, or edit the `src` to a typo'd path in a throwaway copy of the file).
2. Reload the app: confirm the plain `Loader2` spinner renders exactly as it did before this feature existed — no blank screen, no console-uncaught error, no broken layout.
3. Revert the temporary change (or discard the throwaway copy) — do not ship a broken script URL.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add Three.js mitochondria pulse to session-restore screen, with WebGL-capability fallback to the plain spinner"
```

---

## Post-implementation

- [ ] Tell Mario to redeploy `biohackerlatino-web` to Netlify (Tasks 1-2 aren't live until he does).
- [ ] Update the `biohacker_score_status` project memory: this closes out the entire visual/UX/marketing audit except the still-deferred social-proof strip.
