# Macro calculator weight input — fix report

## Bug

User report (Spanish): "la calculadora de macros no deja cambiar los datos con
num[eros] solo con la flecha, esta mal desde el cel no se mira las flechas" — you
can't type a weight value directly into the macro calculator's weight field, only
the native number-input spin arrows work, and those arrows aren't visible on mobile
at all, making the field unusable there.

## Root cause

In `MacroCalculatorCard` (`index.html`, weight `<input type="number">` around line
583), the `onChange` handler clamped the parsed value to `[20, 400]` on **every
keystroke**, not just at save time:

```js
onChange: (e) => {
    if (e.target.value === "") { onWeightChange(null); return; }
    const parsed = parseFloat(e.target.value);
    onWeightChange(Number.isFinite(parsed) ? Math.min(400, Math.max(20, parsed)) : null);
}
```

Because the input is a controlled React component (`value: weightDraft`), typing a
weight digit-by-digit produces intermediate parsed values that are momentarily
below `min=20` (e.g. after typing just "7"). The per-keystroke clamp immediately
snapped that intermediate value to `20` and wrote it back as the input's displayed
value — corrupting the string the user was building. Because the *displayed* value
is what the next keystroke gets appended to (not what the user intended to type),
this doesn't just get "stuck at 20" — it actively corrupts further typing (see RED
evidence below, where typing "75" ends up as "205").

The native spin-button arrows didn't trigger this because each click already starts
from a valid current value and steps by 0.5, so the clamp is a no-op for them. On
mobile, spin arrows aren't rendered at all for `type="number"`, so the field was
entirely unusable there.

`saveWeight()` (around line 1647) did NOT clamp before PATCHing `weight_kg` to
Supabase, so removing the per-keystroke clamp without adding a save-time clamp
would have let out-of-range values (e.g. "5000") reach the database.

## RED evidence (bug proven before the fix)

Throwaway script (not part of the permanent suite): simulated a controlled
`<input>` where each keystroke's `e.target.value` is the digit appended to
whatever the field currently *displays* (i.e., whatever the previous `onChange`
call wrote back via `onWeightChange`) — this matches how a real React controlled
input behaves.

```
=== RED: current (buggy) onChange clamps on every keystroke ===
User intends to type 75 kg, pressing '7' then '5':
  key "7" -> e.target.value="7" -> onWeightChange(20) -> field now shows "20"
  key "5" -> e.target.value="205" -> onWeightChange(205) -> field now shows "205"
RESULT: field ends at "205" (BUG: expected "75", got corrupted because "7" snapped to 20, then "5" appended to "20" -> 205)
```

Confirms the corruption: typing "7" immediately snaps the field to "20" (because
`parsed=7 < min=20`), and the next keystroke "5" is appended to the corrupted
displayed value "20", producing "205" instead of "75".

## Fix applied

Three minimal changes, all inside `MacroCalculatorCard`'s weight input and
`saveWeight()` in `index.html`, no other files touched:

1. **`onChange` (line ~583-587)** — stop clamping on every keystroke. Parse the
   typed value and pass it through as-is; keep the existing NaN/non-finite guard
   (`Number.isFinite(parsed) ? parsed : null`).
2. **`saveWeight()` (line ~1647-1669)** — clamp `weightDraft` to `[20, 400]`
   (`Math.min(400, Math.max(20, weightDraft))`) into a new `clampedWeight` const
   right before it's used in the PATCH body and in `setBodyWeightKg`, so the
   original bounds guarantee is preserved for what's actually persisted.
3. Added `inputMode: "decimal"` to the input's props (alongside the existing
   `type: "number"`, `step: "0.5"`) to reliably surface a numeric keypad on
   mobile browsers for this field.

### Exact diff

```diff
--- a/index.html
+++ b/index.html
@@ -580,10 +580,10 @@ function MacroCalculatorCard({ weightDraft, onWeightChange, onSave, saving, macr
     const weightInputRow = React.createElement("div", { className: "flex items-end gap-2 mb-4" },
         React.createElement("label", { className: "flex-1" },
             React.createElement("div", { className: "text-xs text-slate-400 mb-1" }, "Peso corporal (kg)"),
-            React.createElement("input", { type: "number", step: "0.5", min: "20", max: "400", value: weightDraft !== null && weightDraft !== void 0 ? weightDraft : "", onChange: (e) => {
+            React.createElement("input", { type: "number", inputMode: "decimal", step: "0.5", min: "20", max: "400", value: weightDraft !== null && weightDraft !== void 0 ? weightDraft : "", onChange: (e) => {
                     if (e.target.value === "") { onWeightChange(null); return; }
                     const parsed = parseFloat(e.target.value);
-                    onWeightChange(Number.isFinite(parsed) ? Math.min(400, Math.max(20, parsed)) : null);
+                    onWeightChange(Number.isFinite(parsed) ? parsed : null);
                 }, className: "w-full bg-[#060809] border border-[#1E2535] rounded-lg px-3 py-2 text-slate-100 text-sm outline-none focus:border-[#3DDCFF]" })),
         React.createElement("button", { type: "button", onClick: onSave, disabled: saving || !weightDraft, className: "shrink-0 flex items-center gap-2 bg-[#3DDCFF] text-[#06121A] font-medium text-sm rounded-lg px-4 py-2 hover:brightness-110 transition disabled:opacity-40" },
             saving ? React.createElement(Loader2, { size: 14, className: "animate-spin" }) : React.createElement(Check, { size: 14 }),
@@ -1650,14 +1650,15 @@ function Dashboard({ session, onLogout, onRefreshSession }) {
         setSavingWeight(true);
         setActionError("");
         try {
+            const clampedWeight = Math.min(400, Math.max(20, weightDraft));
             const res = await fetch(`${REST}/profiles?id=eq.${session.user.id}`, {
                 method: "PATCH",
                 headers: { ...authHeaders, Prefer: "return=minimal" },
-                body: JSON.stringify({ weight_kg: weightDraft }),
+                body: JSON.stringify({ weight_kg: clampedWeight }),
             });
             if (!res.ok)
                 throw new Error("No se pudo guardar el peso.");
-            setBodyWeightKg(weightDraft);
+            setBodyWeightKg(clampedWeight);
         }
         catch (e) {
             console.error(e);
```

`FieldSlider` (the `type="range"` component elsewhere) was not touched — range
inputs can't produce out-of-bounds values, so it has no equivalent bug.

## GREEN evidence (fix proven)

Same throwaway script, re-run against a function mirroring the new `onChange`
body (no per-keystroke clamp):

```
=== GREEN: fixed onChange (no per-keystroke clamp) ===
User intends to type 75 kg, pressing '7' then '5':
  key "7" -> e.target.value="7" -> onWeightChange(7) -> field now shows "7"
  key "5" -> e.target.value="75" -> onWeightChange(75) -> field now shows "75"
RESULT: field ends at "75" (expected "75")
```

Typing now proceeds smoothly to the intended value with no snapping/corruption.
(Script kept only as a scratch file outside the repo — not added to `test/`.)

## `npm test` output (67/67 pass, includes syntax-check of index.html's inline scripts)

```
> biohacker-score@1.0.0 test
> node --test test/pure-functions.test.js test/syntax-check.test.js test/stripe-signature.test.mjs test/plan-matching.test.mjs test/diet-macros.test.mjs test/diet-plan-helpers.test.mjs test/revenuecat-event-mapping.test.mjs test/static-cache.test.mjs

✔ calculateMacroTargets computes BMR/TDEE via Mifflin-St Jeor for a male profile (4.0282ms)
✔ calculateMacroTargets subtracts the female offset instead of adding it (0.7272ms)
✔ calculateMacroTargets applies a 500 kcal deficit for cut (0.4787ms)
✔ calculateMacroTargets applies a 300 kcal surplus for bulk (2.7309ms)
✔ calculateMacroTargets falls back to a sedentary-ish multiplier for an unknown activity level (0.9821ms)
✔ calculateMacroTargets sets protein at 2g per kg bodyweight (2.2739ms)
✔ calculateMacroTargets floors carbs at 0 when protein+fat calories would exceed the target (0.6226ms)
✔ parseMealPlanJSON parses a clean JSON object (10.2144ms)
✔ parseMealPlanJSON strips ```json markdown fences (0.4823ms)
✔ parseMealPlanJSON extracts the JSON object from surrounding prose (0.6409ms)
✔ parseMealPlanJSON throws on genuinely unparseable text (1.5718ms)
✔ parseMealPlanJSON throws on missing/undefined text (2.1955ms)
✔ resolveCurrentTier uses subscription_tier when set (0.7822ms)
✔ resolveCurrentTier maps comp_trainer with no tier to elite (0.4609ms)
✔ resolveCurrentTier defaults to basico for anyone else with no tier set (0.7163ms)
✔ findNextTier returns the next plan up when one exists (0.6132ms)
✔ findNextTier returns null for the top tier (nothing above elite) (0.6653ms)
✔ findNextTier returns null for a tier that isn't in the plans list (0.4175ms)
✔ buildQuotaExceededPayload assembles the full upsell shape for a mid-tier client (0.5892ms)
✔ buildQuotaExceededPayload leaves next_tier fields null for an elite client (nothing to upsell to) (0.49ms)
✔ mapStripeStatusToCoachStatus maps active/trialing to active (13.4671ms)
✔ mapStripeStatusToCoachStatus maps past_due as-is (0.4471ms)
✔ mapStripeStatusToCoachStatus maps canceled/unpaid/incomplete_expired to canceled (0.4383ms)
✔ mapStripeStatusToCoachStatus returns null for a non-actionable status (2.173ms)
✔ resolvePlanFromAmount matches the coach price (3.0179ms)
✔ resolvePlanFromAmount matches each client tier by exact amount (1.2276ms)
✔ resolvePlanFromAmount returns null for an amount matching no known plan (1.0681ms)
✔ sleepScore returns null when an input is missing (6.3224ms)
✔ sleepScore is 100 at goal with perfect quality (0.6072ms)
✔ sleepScore penalizes distance from goal (0.5774ms)
✔ nutritionScore returns null when an input is missing (0.8918ms)
✔ nutritionScore floors the fasting component beyond the tolerance window (1.1139ms)
✔ exerciseScore returns null when minutes/intensity missing (0.95ms)
✔ exerciseScore scales with minutes and caps at 100 (0.6767ms)
✔ stressScore returns null when stress level missing (0.8042ms)
✔ stressScore is 100 at or under the goal max (0.9087ms)
✔ stressScore penalizes exceeding the goal max (0.7539ms)
✔ totalScore averages only the non-null categories (0.8258ms)
✔ scoreColor maps score bands to the expected accent colors (0.6192ms)
✔ computeStreak is 0 for no entries (0.5428ms)
✔ computeStreak counts consecutive days ending today (3.7467ms)
✔ computeStreak still counts a streak that ends yesterday (today not logged yet) (0.9169ms)
✔ computeStreak breaks on a gap (0.5942ms)
✔ weeklyComparison returns null with no entries (0.8266ms)
✔ weeklyComparison reports improvement when this week outscores last week (2.1922ms)
✔ INITIAL_PURCHASE grants premium with the matched tier and platform (6.6908ms)
✔ RENEWAL, PRODUCT_CHANGE, and UNCANCELLATION all grant the same way (0.8633ms)
✔ EXPIRATION revokes premium (4.8078ms)
✔ CANCELLATION alone does not revoke access (user keeps access until EXPIRATION) (1.8364ms)
✔ unknown event types are ignored (0.8477ms)
✔ a grant event with no known tier in entitlement_ids is ignored (0.5304ms)
✔ a grant event with no app_user_id is ignored (0.5654ms)
✔ an unrecognized store value still grants, with a null payment_platform (0.4993ms)
✔ cachedFetchJSON fetches over the network and populates the cache on a cold cache (7.4943ms)
✔ cachedFetchJSON serves from cache within the TTL without calling fetch (0.548ms)
✔ cachedFetchJSON refetches once the TTL has expired (0.9161ms)
✔ cachedFetchJSON falls back to a real fetch when the cached entry is corrupted JSON (1.3757ms)
✔ cachedFetchJSON does not cache non-array error responses (0.7761ms)
✔ cachedFetchJSON rejects with a status-401 error instead of returning the error body as data (1.5006ms)
✔ verifyStripeSignature accepts a correctly signed payload with a fresh timestamp (26.786ms)
✔ verifyStripeSignature rejects a payload signed with a different secret (2.975ms)
✔ verifyStripeSignature rejects a tampered body (2.503ms)
✔ verifyStripeSignature rejects a missing or malformed header (0.7615ms)
✔ verifyStripeSignature rejects a validly-signed but stale timestamp (replay protection) (2.4327ms)
✔ verifyStripeSignature accepts a timestamp just inside the tolerance window (1.7598ms)
✔ verifyStripeSignature respects a custom toleranceSeconds override (1.4738ms)
✔ every inline <script> block in index.html is syntactically valid JS (6.8116ms)
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 476.625
```

## `npm run lint` output (0 errors; 5 pre-existing warnings unrelated to this change)

```
> biohacker-score@1.0.0 lint
> eslint .


C:\Users\PC\Desktop\.claude\biohacker-score\index.html
    69:7   warning  'COACH_PLAN_LINK' is assigned a value but never used       no-unused-vars
   156:14  warning  'e' is defined but never used                              no-unused-vars
  1119:12  warning  'checkingPlan' is assigned a value but never used          no-unused-vars
  1152:12  warning  'loadingExclusions' is assigned a value but never used     no-unused-vars
  1152:31  warning  'setLoadingExclusions' is assigned a value but never used  no-unused-vars

✖ 5 problems (0 errors, 5 warnings)
```

(None of these warnings touch lines 579-617 or 1647-1669, the edited blocks.)

## Manual paren-matching sanity check

Re-read both edited blocks in `index.html` (weight `weightInputRow` around
line 579-617, `saveWeight` around line 1647-1669) — both are syntactically valid
`React.createElement` trees (also confirmed by the `syntax-check.test.js` suite
test above, which parses every inline `<script>` block in `index.html`).

## Note on an unrelated design-hook flag

The editor's design-lint hook (`impeccable`) flagged 3 pre-existing "overused
font" findings on lines 16, 22, 23 (Inter / Space Grotesk font imports in
`<head>`). These are unrelated to this fix (no line near the weight
input/`saveWeight` edits) and predate this change — left untouched, out of scope
per the instructions to not restructure anything beyond this one fix.

## Not committed

No `git add`/`git commit` was run, per instructions. The working-tree diff above
is the only change, left in place for human review.
