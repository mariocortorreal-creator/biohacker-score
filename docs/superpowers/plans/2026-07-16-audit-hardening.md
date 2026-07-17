# Audit Hardening (Rate Limiting + Static Content Cache) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `generate-diet-plan` monthly-quota race condition at the database level, and stop re-fetching static coach-curated content (exercises, supplement/nutrition recommendations, subscription plans) on every Dashboard mount.

**Architecture:** Task 1 adds a `BEFORE INSERT` trigger on `diet_plans`, serialized per-client via `pg_advisory_xact_lock`, so the quota check and the insert happen atomically in one transaction instead of two separate HTTP round-trips from the edge function; the edge function is updated to translate the trigger's rejection into the same `quota_exceeded` response shape it already returns for the non-race case. Task 2 adds a small localStorage-backed TTL cache (`cachedFetchJSON`) inside `index.html`, sliced out and unit-tested the same way the existing scoring engine is (VM-eval a marked section of `index.html`, no build step), and wires the four static-content loaders through it.

**Tech Stack:** Postgres/PL-pgSQL (Supabase migration), Deno edge function (TypeScript), plain browser JS in `index.html` (no bundler), `node --test` for unit tests.

## Global Constraints

- No build step for `index.html` — new code goes inline in the single `<script>` block, `React.createElement` style only if touching JSX-shaped code (this plan doesn't).
- New pure/testable logic must be bounded by `// ---------- <Section> ----------` / `// ---------- End <Section> ----------` comment markers so a `test/lib/load-*.js` VM-slice loader can extract it, matching the existing `load-scoring-engine.js` convention.
- UI-facing strings stay in Spanish.
- Migrations are timestamped `YYYYMMDDHHMMSS_description.sql` in `supabase/migrations/`; do not edit past migrations, only add new ones.
- Do not apply the migration to the live Supabase project or push commits to `origin/main` without explicit confirmation — this touches the paid-plan quota path in production. Stop at the designated checkpoint in Task 1 and ask.
- Run `npm test` and `npm run lint` before each commit; both must pass clean (repo convention, currently 45/45 tests and 0 lint errors).

---

### Task 1: Close the diet-plan quota race condition

**Files:**
- Create: `supabase/migrations/20260716210000_diet_plan_quota_trigger.sql`
- Modify: `supabase/functions/generate-diet-plan/index.ts:242-252`

**Interfaces:**
- Consumes: existing `public.get_client_diet_quota(uuid) returns int` function (already deployed, not tracked in migration history — call it by name, do not redefine it).
- Produces: nothing consumed by Task 2 — these two tasks are independent.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260716210000_diet_plan_quota_trigger.sql`:

```sql
-- Closes a TOCTOU race in generate-diet-plan: the edge function checks monthly
-- usage via a separate SELECT (index.ts lines ~97-104) before a separate INSERT
-- (index.ts lines ~242-250), as two distinct HTTP round-trips through PostgREST.
-- N parallel requests from the same client can all pass the check before any of
-- them commits, bypassing the monthly quota on a real per-call Anthropic API cost.
--
-- This trigger re-checks the quota atomically inside the same transaction as the
-- INSERT. pg_advisory_xact_lock serializes concurrent inserts for the same
-- client_id (the lock is released automatically at transaction end), so two
-- concurrent requests from the same client can no longer both read a
-- pre-limit count before either commits — the second one blocks until the
-- first's transaction finishes, then sees the incremented count.
create or replace function public.enforce_diet_plan_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quota int;
  v_used int;
  v_month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(new.client_id::text));

  v_quota := public.get_client_diet_quota(new.client_id);
  v_month_start := date_trunc('month', now());

  select count(*) into v_used
  from public.diet_plans
  where client_id = new.client_id
    and generated_at >= v_month_start;

  if v_used >= v_quota then
    raise exception 'Cuota mensual de planes de alimentación alcanzada (% de %).', v_used, v_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_diet_plan_quota() from public, anon, authenticated;

drop trigger if exists trg_enforce_diet_plan_quota on public.diet_plans;

create trigger trg_enforce_diet_plan_quota
  before insert on public.diet_plans
  for each row
  execute function public.enforce_diet_plan_quota();
```

- [ ] **Step 2: Update the edge function to translate a trigger rejection into the existing `quota_exceeded` shape**

In `supabase/functions/generate-diet-plan/index.ts`, replace lines 242-252 (the `sbInsert("diet_plans", {...})` call and the `return json(...)` right after it):

Current code being replaced:
```ts
    const inserted = await sbInsert("diet_plans", {
      client_id: clientId,
      calorie_target: calorieTarget,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      meal_plan: mealPlan,
      input_snapshot: inputSnapshot,
    });

    return json({ diet_plan: Array.isArray(inserted) ? inserted[0] : inserted }, 200);
```

New code:
```ts
    // Inserted via a direct fetch (not the generic sbInsert helper, which just
    // throws on !ok) so a rejection from trg_enforce_diet_plan_quota — which
    // re-checks the quota atomically at insert time and can reject a request that
    // passed the pre-check above under concurrent load — surfaces the same
    // quota_exceeded shape the pre-check returns, instead of a generic 500.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/diet_plans`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_id: clientId,
        calorie_target: calorieTarget,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        meal_plan: mealPlan,
        input_snapshot: inputSnapshot,
      }),
    });

    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      if (errBody.includes("Cuota mensual de planes de alimentación")) {
        return json({ quota_exceeded: true, used_this_month: usedThisMonth, quota }, 200);
      }
      console.error("diet_plans insert failed:", insertRes.status, errBody);
      return json({ error: "internal_error" }, 500);
    }

    const inserted = await insertRes.json();
    return json({ diet_plan: Array.isArray(inserted) ? inserted[0] : inserted }, 200);
```

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

Run: `npm test`
Expected: `# pass 45` (same count as before — this task adds no new unit tests, since the changed logic is I/O-bound Deno handler wiring and a SQL trigger, neither of which fit this repo's existing `node --test` harness; see Step 4 for the real verification).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: `0 errors` (same 4 pre-existing `no-unused-vars` warnings as before, unrelated to this change).

- [ ] **Step 5: STOP — confirm before touching the live database**

This migration has not been applied to the live Supabase project (`bciwxtjgabbnuxjxrwzt`) and the edge function has not been redeployed. Both changes affect the real paid-plan quota path. Before proceeding:
1. Ask the user to confirm applying the migration (via `supabase db push` or the Supabase MCP `apply_migration` tool) and redeploying `generate-diet-plan` (`supabase functions deploy generate-diet-plan` or equivalent).
2. Do not run either action without that explicit go-ahead, even though the files are ready.

- [ ] **Step 6: (After confirmation) Apply and verify**

Apply the migration, then verify the trigger actually blocks a quota-exceeding insert — e.g. via the Supabase MCP `execute_sql` tool against a disposable test client id:
```sql
-- Pick any real profile id and quota tier for a smoke test, then clean up:
select public.get_client_diet_quota('<test-client-uuid>');
-- Insert rows up to quota, then attempt one more insert with the same shape
-- generate-diet-plan uses — the (quota+1)th insert must raise the P0001 exception.
```
Expected: the final insert raises `Cuota mensual de planes de alimentación alcanzada (...)`. Clean up any test rows inserted into `diet_plans` afterward.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260716210000_diet_plan_quota_trigger.sql supabase/functions/generate-diet-plan/index.ts
git commit -m "fix: close diet-plan monthly quota race with a DB-level trigger"
```

---

### Task 2: Cache static coach-curated content in the frontend

**Files:**
- Modify: `index.html` (add a new bounded section before the component definitions; update 4 call sites)
- Create: `test/lib/load-static-cache.js`
- Create: `test/static-cache.test.mjs`
- Modify: `package.json:scripts.test`

**Interfaces:**
- Produces: `cachedFetchJSON(cacheKey, url, headers, ttlMs = STATIC_CACHE_TTL_MS, storage = window.localStorage, fetcher = window.fetch) => Promise<any>` and `STATIC_CACHE_TTL_MS` (number, ms), both defined at top level in `index.html`, bounded by markers `// ---------- Static content cache ----------` / `// ---------- End static content cache ----------`.
- Consumes: nothing from Task 1.

- [ ] **Step 1: Write the failing tests first**

Create `test/lib/load-static-cache.js`:

```js
// index.html has no build step and no module system (see CLAUDE.md): every function
// lives inline in one <script> block, addressed by global name, not exported. This
// mirrors load-scoring-engine.js: slice out just the "Static content cache" section
// (bounded by the section-comment markers already present in index.html) and
// evaluate that slice in an isolated VM context, so this stays testable under plain
// Node with no browser and no DOM/localStorage/fetch globals required at load time.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START_MARKER = "// ---------- Static content cache ----------";
const END_MARKER = "// ---------- End static content cache ----------";

const EXPORT_NAMES = ["cachedFetchJSON", "STATIC_CACHE_TTL_MS"];

function loadStaticCache() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "load-static-cache: could not find the expected section markers in index.html " +
        `("${START_MARKER}" .. "${END_MARKER}") — did the section comments move or get renamed?`
    );
  }

  const code = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    code + `\nglobalThis.__exports = { ${EXPORT_NAMES.join(", ")} };`,
    sandbox,
    { filename: "index.html (static cache slice)" }
  );
  return sandbox.__exports;
}

module.exports = { loadStaticCache };
```

Create `test/static-cache.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStaticCache } from "./lib/load-static-cache.js";

const { cachedFetchJSON } = loadStaticCache();

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = v;
    },
    _store: store,
  };
}

test("cachedFetchJSON fetches over the network and populates the cache on a cold cache", async () => {
  const storage = makeStorage();
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => ({ hello: "world" }) };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 1000, storage, fetcher);

  assert.deepEqual(data, { hello: "world" });
  assert.equal(fetchCalls, 1);
  const stored = JSON.parse(storage._store["k"]);
  assert.deepEqual(stored.data, { hello: "world" });
  assert.equal(typeof stored.ts, "number");
});

test("cachedFetchJSON serves from cache within the TTL without calling fetch", async () => {
  const cached = JSON.stringify({ data: { hello: "cached" }, ts: Date.now() });
  const storage = makeStorage({ k: cached });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => ({ hello: "network" }) };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 60000, storage, fetcher);

  assert.deepEqual(data, { hello: "cached" });
  assert.equal(fetchCalls, 0);
});

test("cachedFetchJSON refetches once the TTL has expired", async () => {
  const staleTs = Date.now() - 10000;
  const cached = JSON.stringify({ data: { hello: "stale" }, ts: staleTs });
  const storage = makeStorage({ k: cached });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => ({ hello: "fresh" }) };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 1000, storage, fetcher);

  assert.deepEqual(data, { hello: "fresh" });
  assert.equal(fetchCalls, 1);
});

test("cachedFetchJSON falls back to a real fetch when the cached entry is corrupted JSON", async () => {
  const storage = makeStorage({ k: "not-json{{{" });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => ({ hello: "recovered" }) };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 60000, storage, fetcher);

  assert.deepEqual(data, { hello: "recovered" });
  assert.equal(fetchCalls, 1);
});
```

- [ ] **Step 2: Run the new test file to verify it fails**

Run: `node --test test/static-cache.test.mjs`
Expected: FAIL — `load-static-cache: could not find the expected section markers in index.html` (the section doesn't exist in `index.html` yet).

- [ ] **Step 3: Add the `cachedFetchJSON` section to `index.html`**

Find the end of the scoring-engine-adjacent utility code — insert this new section immediately before the first `function App(` or component definition (search for where top-level helper functions like `DEFAULT_GOALS` end and component code begins; keep it a standalone top-level block, not inside any component):

```js
// ---------- Static content cache ----------
// Coach-curated reference data (exercises, supplement_recommendations,
// nutrition_recommendations, subscription_plans) is identical for every user
// (RLS lets any authenticated user read all of it) and rarely changes, but
// Dashboard's mount effect re-fetches all four on every login/page load. At
// ~1000 concurrent users that's redundant read traffic against Postgres for
// content that didn't change. cachedFetchJSON wraps a GET with a
// localStorage-backed TTL cache so repeat loads within the TTL skip the
// network call entirely. Matches this file's existing convention of not
// checking res.ok on these GETs (see loadSupplements etc.) — a non-2xx
// response gets cached as-is, same practical outcome as today since callers
// only ever check Array.isArray(data) on the result.
const STATIC_CACHE_TTL_MS = 15 * 60 * 1000;
function cachedFetchJSON(cacheKey, url, headers, ttlMs = STATIC_CACHE_TTL_MS, storage = window.localStorage, fetcher = window.fetch) {
    try {
        const raw = storage.getItem(cacheKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.ts === "number" && Date.now() - parsed.ts < ttlMs) {
                return Promise.resolve(parsed.data);
            }
        }
    }
    catch (e) {
        // corrupted or unavailable cache entry (e.g. private browsing) — fall through to a real fetch
    }
    return fetcher(url, { headers }).then((res) => res.json()).then((data) => {
        try {
            storage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        }
        catch (e) {
            // storage full/unavailable — cache is best-effort, not required for correctness
        }
        return data;
    });
}
// ---------- End static content cache ----------
```

- [ ] **Step 4: Run the test file again to verify it passes**

Run: `node --test test/static-cache.test.mjs`
Expected: `# pass 4`, `# fail 0`.

- [ ] **Step 5: Wire the four loaders through `cachedFetchJSON`**

In `index.html`, replace each of these four fetch call sites (exact current lines may have shifted slightly after Step 3's insertion — locate by function name):

`loadExerciseLibrary` (currently around line 1056-1069), replace:
```js
            const res = await fetch(`${REST}/exercises?select=id,name,muscle_group,equipment,instructions,video_url,difficulty_level&order=difficulty_level.asc,muscle_group.asc,name.asc`, { headers: authHeaders });
            const data = await res.json();
            setExerciseLibrary(Array.isArray(data) ? data : []);
```
with:
```js
            const data = await cachedFetchJSON("cache_exercises", `${REST}/exercises?select=id,name,muscle_group,equipment,instructions,video_url,difficulty_level&order=difficulty_level.asc,muscle_group.asc,name.asc`, authHeaders);
            setExerciseLibrary(Array.isArray(data) ? data : []);
```

`loadSupplements` (currently around line 1231-1242), replace:
```js
            const res = await fetch(`${REST}/supplement_recommendations?select=*&order=display_order.asc`, { headers: authHeaders });
            const data = await res.json();
            setSupplementRecs(Array.isArray(data) ? data : []);
```
with:
```js
            const data = await cachedFetchJSON("cache_supplement_recommendations", `${REST}/supplement_recommendations?select=*&order=display_order.asc`, authHeaders);
            setSupplementRecs(Array.isArray(data) ? data : []);
```

`loadPremiumContent` (currently around line 1243-1256), replace:
```js
            const res = await fetch(`${REST}/nutrition_recommendations?select=*&order=display_order.asc`, { headers: authHeaders });
            const data = await res.json();
            setNutritionRecs(Array.isArray(data) ? data : []);
```
with:
```js
            const data = await cachedFetchJSON("cache_nutrition_recommendations", `${REST}/nutrition_recommendations?select=*&order=display_order.asc`, authHeaders);
            setNutritionRecs(Array.isArray(data) ? data : []);
```

`loadSubscriptionPlans` (currently around line 1261-1270), replace:
```js
            const res = await fetch(`${REST}/subscription_plans?select=*&order=price_usd.asc`, { headers: authHeaders });
            const data = await res.json();
            setSubscriptionPlans(Array.isArray(data) ? data : []);
```
with:
```js
            const data = await cachedFetchJSON("cache_subscription_plans", `${REST}/subscription_plans?select=*&order=price_usd.asc`, authHeaders);
            setSubscriptionPlans(Array.isArray(data) ? data : []);
```

- [ ] **Step 6: Add the new test file to the `npm test` script**

In `package.json`, update the `test` script (append `test/static-cache.test.mjs`):
```json
"test": "node --test test/pure-functions.test.js test/syntax-check.test.js test/stripe-signature.test.mjs test/plan-matching.test.mjs test/diet-macros.test.mjs test/revenuecat-event-mapping.test.mjs test/static-cache.test.mjs"
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: `# pass 49`, `# fail 0` (45 existing + 4 new).

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: `0 errors` (same 4 pre-existing warnings).

- [ ] **Step 9: Manual smoke test in a browser**

Serve the directory (`npx serve` or `python -m http.server`) and open `index.html`, log in, open DevTools → Application → Local Storage. Confirm four new keys appear (`cache_exercises`, `cache_supplement_recommendations`, `cache_nutrition_recommendations`, `cache_subscription_plans`) each holding `{"data": [...], "ts": <number>}`. Reload the page within 15 minutes and confirm (via the Network tab) that these four endpoints are NOT re-requested, while `daily_entries`, `profiles`, etc. still are.

- [ ] **Step 10: Commit**

```bash
git add index.html test/lib/load-static-cache.js test/static-cache.test.mjs package.json
git commit -m "perf: cache static coach-curated content with a localStorage TTL cache"
```

---

## Self-Review Notes

- **Spec coverage**: Task 1 covers audit priority #1 (rate limiting / TOCTOU on `generate-diet-plan`). Task 2 covers audit point #9 (caching). Priorities #2 (stripe-webhook silent failure), #3 (RLS verification), #4 (Sentry) and the content-hub items were explicitly excluded from this plan's scope per user confirmation — not gaps, deliberate exclusions.
- **Placeholder scan**: no TBD/TODO markers; every step has literal code.
- **Type consistency**: `cachedFetchJSON`'s signature is identical across its definition (Task 2 Step 3) and all four call sites (Task 2 Step 5) and the test file (Task 2 Step 1) — `(cacheKey, url, headers, ttlMs?, storage?, fetcher?)`.
