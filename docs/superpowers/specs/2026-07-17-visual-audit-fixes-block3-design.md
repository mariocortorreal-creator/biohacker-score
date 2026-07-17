# Visual audit fixes — Block 3: premium aesthetic direction (design)

**Source:** same audit as Blocks 1-2 (`auditoria-diseno-ux-marketing.md`), section 5 ("Dirección estética 'premium' — dorado + dashboard más vivo"), the last deferred item from that document. Unlike Blocks 1-2, this is explicitly framed by the audit itself as a new visual direction, not a bug fix — confirmed with Mario this needed its own brainstorming pass rather than being folded into the earlier blocks.

**Repos touched:** both. 5.1 and 5.2 are `biohackerlatino-web` (no git); 5.3 and 5.4 are `biohacker-score` (git-tracked, this is where the plan/spec docs live).

**Verified against real code before writing this spec:**
- 5.3's anchor point (`MacroCalculatorCard`, `biohacker-score/index.html:491-520`) already renders kcal/protein/fat/carbs as plain numbers with color coding (`#7FE3A3` protein, `#FFC857` fat, `#3DDCFF` carbs) — no bars today.
- 5.4's anchor point had to be inferred — the audit doesn't name one. `App`'s session-restore loading screen (`biohacker-score/index.html:2123-2124`) currently shows a generic spinning `Loader2` icon on `#060809`; this is the only "quick daily check" loading moment in the whole app (matches the audit's own framing "pensada para chequeo diario rápido") and is low-risk to swap since it's brief and already isolated behind the `restoring` boolean.
- 5.2's anchor point (`.ring-wrap`, `assets/style.css:866`, driven by `ringObserver` in `biohackerlatino-web/index.html`) already has a static `filter: drop-shadow(...)` glow — this task makes it pulse specifically once the ring finishes animating, not change the glow itself.
- 5.1's anchor point (`precios/index.html`'s `renderCard`) already got a `.featured` treatment for the Pro tier in Block 2 — this task adds a second, visually distinct treatment for Elite, following the same `p.tier === "..."` pattern.

## 1. Gold accent for the Elite pricing tier

`precios/index.html` (same file, same local `<style>` block as Block 2's `.price-card.featured`): add `--gold: #D4AF37` / `--gold-dim: rgba(212,175,55,.14)`, and a `.price-card.tier-elite` rule (gold border + subtle gradient wash) applied when `p.tier === "elite"` in `renderCard`. Cyan stays the site's one accent everywhere else — gold is reserved exclusively for marking this one tier, not a palette-wide change.

## 2. Ring glow-on-complete

`ringObserver` in `biohackerlatino-web/index.html` (touched twice already, in Block 1 for the threshold fix and its 3s fallback) adds a `complete` class to `.ring-wrap` once the score tween finishes — in **both** the normal completion path and the 3s stuck-scroll fallback added in Block 1, so the pulse fires reliably either way. New `@keyframes ring-pulse` in `assets/style.css` animates `filter: drop-shadow(...)` between the glow's current static value and a brighter peak, looping.

## 3. Macro-split bars (deviates from a literal reading of the audit)

The audit's mockup shows a bar under every macro value, framed as "progress." That doesn't map cleanly onto what `MacroCalculatorCard` actually has: kcal is the day's calorie *target* (not a fraction of itself), and there's no separate "current vs. goal" pair for protein/fat/carbs the way the daily Score has (this card computes *recommended* grams from body weight + goal, it doesn't track *today's actual intake* against them). Showing a fake 0-100% "progress" bar here would misrepresent the data.

Instead: protein, fat, and carbs each get a thin bar showing **their share of the day's total calories** (protein_g × 4, fat_g × 9, carbs_g × 4, each ÷ `targetKcal`) — a macro-split visualization, which *is* a real, honest relationship in the data. Kcal itself keeps its plain number, no bar (it's the 100% these three add up to, a bar under it would be redundant). Same color coding already in place (`#7FE3A3`/`#FFC857`/`#3DDCFF`) carries into each bar fill.

## 4. Mitochondria pulse (Three.js, App's session-restore loading screen)

**Confirmed with Mario:** Three.js (not the audit's own lighter-weight SVG+CSS recommendation), runs in both the web build and the Capacitor-wrapped native app, with a mandatory automatic fallback to the existing `Loader2` spinner whenever Three.js fails to load or `WebGLRenderingContext` isn't available — checked *before* mounting the scene, not caught after a failed render. This loading screen is the single most-repeated moment in the entire app (every session restore, every day, on every platform), so correctness of the fallback matters more here than anywhere else touched in this project.

- Three.js loaded via a pinned-version CDN `<script>` in `<head>` (UMD build, matching the existing plain-`<script>`-tag pattern already used for React/ReactDOM/Capacitor plugins — no bundler, no ES module import needed).
- A capability check (`typeof THREE !== "undefined"` **and** a real WebGL context probe, e.g. attempting to get `"webgl"`/`"webgl2"` from a throwaway canvas) gates whether the Three.js scene mounts at all; if either check fails, `App` renders the plain spinner exactly as it does today — zero behavior change on failure.
- Scene: a low-poly deformed icosahedron (procedural vertex displacement, no external noise library — same "no new dependency beyond the one CDN script" discipline as everywhere else in this project) in the app's cyan accent, emissive intensity pulsing via a sine wave driven off elapsed time in the render loop. Deliberately abstract/organic, not an anatomically literal mitochondria render.
- Cleanup on unmount: dispose geometry, material, and renderer; cancel the animation frame; remove any resize listener — same discipline already established for `initAuthParticles` in Block 1, and for the same reason (this is a React SPA, the loading screen unmounts as soon as session restore finishes, which can be near-instant).

## Testing

`biohacker-score` has `npm test` including a syntax-check pass over every inline `<script>` block — must stay green after all `biohacker-score`-side changes (items 3 and 4). `biohackerlatino-web` has no automated tests (items 1 and 2) — same ad hoc Node syntax-check + manual browser verification pattern used in Blocks 1-2. Item 4 additionally needs manual verification of the fallback path specifically (e.g. temporarily renaming the Three.js `<script src>` to a 404 to confirm the plain spinner still renders correctly) — this is the one piece of new logic in this whole project where "the happy path works" isn't sufficient verification on its own.
