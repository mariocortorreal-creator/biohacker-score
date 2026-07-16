# IAP (RevenueCat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real In-App Purchase to the native iOS/Android app (via RevenueCat) for the 3 client tiers, so the app complies with Apple/Google store policy for the LatAm market, while the web checkout keeps using Stripe unchanged.

**Architecture:** RevenueCat's Capacitor SDK drives StoreKit/Play Billing purchases client-side; a new `revenuecat-webhook` Supabase Edge Function (mirroring the existing `stripe-webhook`) reconciles subscription state into `public.profiles`, which `is_premium()` already reads regardless of payment channel.

**Tech Stack:** Capacitor 8, `@revenuecat/purchases-capacitor`, Supabase Edge Functions (Deno), Node's built-in test runner (`node --test`), esbuild (existing `native-bridge.js` bundling).

**Spec:** `docs/superpowers/specs/2026-07-16-iap-design.md`

## Global Constraints

- Web checkout (`biohackerlatino.com/precios`, `stripe-webhook`) is not modified at all.
- Only the 3 client tiers (`basico`, `pro`, `elite`) go through RevenueCat/IAP — the coach plan stays manual/Stripe.
- IAP prices must match the existing Stripe prices: básico $7.99, pro $14.00, elite $19.00.
- `is_premium()` and the `premium_source` check constraint are not modified — both payment channels keep setting `premium_source = 'paid'`.
- RevenueCat is configured with `appUserID` = the Supabase user id (`session.user.id`) — no separate customer-id mapping table.
- RevenueCat Entitlements and Offering packages must be named exactly `basico`, `pro`, `elite` (matching the tier slugs) — this is what lets the webhook and the client match tiers without a lookup table.
- Native-only code stays gated behind the existing `isNativeApp` constant (`index.html:72`), the same pattern already used for Health/Health Connect.
- New Capacitor-plugin JS goes through `src/native-bridge.js` (esbuild-bundled), never imported directly into `index.html`'s plain `<script>` — same reason `capacitor-health` already works this way.

---

### Task 1: Create the RevenueCat project and catalog

**Files:** None — this is account/dashboard setup, no code.

**Interfaces:**
- Produces: two public API keys (iOS, Android) and one webhook shared-secret string, all consumed by later tasks.

- [ ] **Step 1: Create the RevenueCat project**

Go to https://app.revenuecat.com, sign up/log in, create a new project called "Biohacker Score".

- [ ] **Step 2: Add the iOS and Android apps**

Inside the project, add:
- An iOS app, bundle ID `com.biohackerlatino.app` (matches `capacitor.config.json`'s `appId`).
- An Android app, package name `com.biohackerlatino.app`.

Copy each app's public API key somewhere safe — Task 6 needs both.

- [ ] **Step 3: Create 3 Entitlements named exactly `basico`, `pro`, `elite`**

In RevenueCat → Entitlements, create three entitlements with identifiers `basico`, `pro`, `elite` (must match exactly, lowercase, no extra words — the webhook in Task 4 matches on these exact strings).

- [ ] **Step 4: Create the 3 products in App Store Connect / Play Console and attach them**

For each tier, create an auto-renewing subscription product priced at the Stripe-matching price ($7.99 / $14.00 / $19.00), with a 10-day free trial (introductory offer), in both App Store Connect and Google Play Console. Then in RevenueCat → Products, import/attach each platform's product to its matching entitlement from Step 3.

(App Store Connect and Play Console access depend on the Apple Developer Program / Google Play Console accounts, tracked separately as a store-submission blocker — this step can't complete until those exist.)

- [ ] **Step 5: Create one Offering with 3 packages named `basico`, `pro`, `elite`**

In RevenueCat → Offerings, create an Offering (e.g. "default"), and inside it add 3 packages — set each package's identifier to `basico`, `pro`, `elite` respectively, each pointing at the matching product from Step 4. Mark this Offering as "current".

- [ ] **Step 6: Configure the webhook**

In RevenueCat → Integrations → Webhooks, add a webhook URL pointing at `https://bciwxtjgabbnuxjxrwzt.supabase.co/functions/v1/revenuecat-webhook` (not deployed yet — that's fine, RevenueCat just stores the URL). Set an "Authorization header value" to a random secret string you generate yourself (e.g. `openssl rand -hex 32`) — save this string, Task 4 needs it verbatim as `REVENUECAT_WEBHOOK_AUTH_HEADER`.

---

### Task 2: Add `payment_platform` column to `profiles`

**Files:**
- Create: `supabase/migrations/20260716200000_add_payment_platform_column.sql`

**Interfaces:**
- Produces: `public.profiles.payment_platform` column (`text`, nullable, check constraint `'stripe' | 'apple_iap' | 'google_iap'`), read/written only by Task 4's webhook.

- [ ] **Step 1: Write the migration**

```sql
-- Informational only — records which channel granted a profile's current premium
-- access. Never read by is_premium() or the premium_source check constraint; those
-- stay untouched. Lets support/analytics answer "how did this user pay?" without
-- guessing from stripe_customer_id being null.
alter table public.profiles
  add column payment_platform text check (payment_platform in ('stripe', 'apple_iap', 'google_iap'));
```

- [ ] **Step 2: Apply it locally and confirm it runs cleanly**

Run: `npx supabase db push` (or however Mario normally applies migrations to this project — check `supabase/config.toml` / prior session notes if unsure which command is used here).
Expected: migration applies with no errors, and `payment_platform` appears as a nullable column on `profiles`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260716200000_add_payment_platform_column.sql
git commit -m "feat: add profiles.payment_platform column for IAP bookkeeping"
```

---

### Task 3: Pure RevenueCat event-mapping module

**Files:**
- Create: `supabase/functions/_shared/revenuecat-event-mapping.mjs`
- Test: `test/revenuecat-event-mapping.test.mjs`
- Modify: `package.json:8` (test script — append the new test file)

**Interfaces:**
- Produces: `mapRevenueCatEvent(event)` — pure function, no I/O. Input `event` shape: `{ type: string, app_user_id: string | null, entitlement_ids: string[] | undefined, store: string | undefined }`. Returns one of:
  - `{ action: "grant", profileId: string, patch: { premium_source: "paid", subscription_tier: string, payment_platform: "apple_iap" | "google_iap" | null } }`
  - `{ action: "revoke", profileId: string, patch: { premium_source: null } }`
  - `{ action: "ignore" }`
- Consumed by: Task 4's `revenuecat-webhook/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `test/revenuecat-event-mapping.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRevenueCatEvent } from "../supabase/functions/_shared/revenuecat-event-mapping.mjs";

test("INITIAL_PURCHASE grants premium with the matched tier and platform", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["pro"],
    store: "APP_STORE",
  });
  assert.deepEqual(result, {
    action: "grant",
    profileId: "user-123",
    patch: { premium_source: "paid", subscription_tier: "pro", payment_platform: "apple_iap" },
  });
});

test("RENEWAL, PRODUCT_CHANGE, and UNCANCELLATION all grant the same way", () => {
  for (const type of ["RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]) {
    const result = mapRevenueCatEvent({
      type,
      app_user_id: "user-123",
      entitlement_ids: ["elite"],
      store: "PLAY_STORE",
    });
    assert.equal(result.action, "grant", `expected grant for ${type}`);
    assert.equal(result.patch.subscription_tier, "elite");
    assert.equal(result.patch.payment_platform, "google_iap");
  }
});

test("EXPIRATION revokes premium", () => {
  const result = mapRevenueCatEvent({
    type: "EXPIRATION",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "APP_STORE",
  });
  assert.deepEqual(result, {
    action: "revoke",
    profileId: "user-123",
    patch: { premium_source: null },
  });
});

test("CANCELLATION alone does not revoke access (user keeps access until EXPIRATION)", () => {
  const result = mapRevenueCatEvent({
    type: "CANCELLATION",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("unknown event types are ignored", () => {
  const result = mapRevenueCatEvent({ type: "BILLING_ISSUE", app_user_id: "user-123" });
  assert.equal(result.action, "ignore");
});

test("a grant event with no known tier in entitlement_ids is ignored", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["some_other_entitlement"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("a grant event with no app_user_id is ignored", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: null,
    entitlement_ids: ["pro"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("an unrecognized store value still grants, with a null payment_platform", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "STRIPE",
  });
  assert.equal(result.action, "grant");
  assert.equal(result.patch.payment_platform, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/revenuecat-event-mapping.test.mjs`
Expected: FAIL — `Cannot find module '../supabase/functions/_shared/revenuecat-event-mapping.mjs'`

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/_shared/revenuecat-event-mapping.mjs`:

```javascript
// Pure decision logic for the RevenueCat webhook (supabase/functions/revenuecat-webhook/
// index.ts) — kept side-effect-free so it's testable under plain Node, same pattern as
// stripe-signature.mjs / plan-matching.mjs / diet-macros.mjs.

const KNOWN_TIERS = ["basico", "pro", "elite"];
const GRANT_EVENT_TYPES = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"];
const REVOKE_EVENT_TYPES = ["EXPIRATION"];

function platformForStore(store) {
  if (store === "APP_STORE") return "apple_iap";
  if (store === "PLAY_STORE") return "google_iap";
  return null;
}

export function mapRevenueCatEvent(event) {
  const profileId = event?.app_user_id ?? null;
  const type = event?.type ?? null;

  if (GRANT_EVENT_TYPES.includes(type)) {
    const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
    const tier = entitlementIds.find((id) => KNOWN_TIERS.includes(id)) ?? null;
    if (!tier || !profileId) return { action: "ignore" };
    return {
      action: "grant",
      profileId,
      patch: {
        premium_source: "paid",
        subscription_tier: tier,
        payment_platform: platformForStore(event.store),
      },
    };
  }

  if (REVOKE_EVENT_TYPES.includes(type)) {
    if (!profileId) return { action: "ignore" };
    return {
      action: "revoke",
      profileId,
      patch: { premium_source: null },
    };
  }

  return { action: "ignore" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/revenuecat-event-mapping.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the new test file into `npm test`**

In `package.json`, find the `"test"` script (currently ends with `test/diet-macros.test.mjs`) and append the new file:

```json
"test": "node --test test/pure-functions.test.js test/syntax-check.test.js test/stripe-signature.test.mjs test/plan-matching.test.mjs test/diet-macros.test.mjs test/revenuecat-event-mapping.test.mjs"
```

- [ ] **Step 6: Run the full suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS, 44 tests (37 existing + 7 new).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/revenuecat-event-mapping.mjs test/revenuecat-event-mapping.test.mjs package.json
git commit -m "test: add RevenueCat event-mapping module with full coverage"
```

---

### Task 4: `revenuecat-webhook` Edge Function

**Files:**
- Create: `supabase/functions/revenuecat-webhook/index.ts`

**Interfaces:**
- Consumes: `mapRevenueCatEvent(event)` from Task 3, exact same return shape documented there.
- Produces: a deployed Edge Function at `revenuecat-webhook`, consumed by RevenueCat's webhook delivery (configured in Task 1, Step 6) — nothing in this codebase calls it directly.

- [ ] **Step 1: Write the function**

Create `supabase/functions/revenuecat-webhook/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { mapRevenueCatEvent } from "../_shared/revenuecat-event-mapping.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REVENUECAT_WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!;

// Returns whether the update succeeded, so the caller can return a non-2xx status and
// let RevenueCat retry delivery — logging alone isn't enough, an update failure must
// actually surface as a failed webhook response (see the design spec's Error Handling
// section: "Webhook handler errors: return non-2xx so RevenueCat retries delivery").
async function updateProfile(profileId: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`Failed to update profile ${profileId} from RevenueCat webhook:`, await res.text());
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // RevenueCat sends back whatever exact string was configured as the webhook's
  // "Authorization header value" (Task 1, Step 6) — not an HMAC signature like Stripe's,
  // so this is a plain equality check against that configured secret.
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== REVENUECAT_WEBHOOK_AUTH_HEADER) {
    return new Response("Invalid authorization", { status: 401 });
  }

  const body = await req.json();
  const event = body?.event ?? null;
  if (!event) {
    return new Response("Missing event", { status: 400 });
  }

  const result = mapRevenueCatEvent(event);

  if (result.action === "grant" || result.action === "revoke") {
    const ok = await updateProfile(result.profileId, result.patch);
    if (!ok) {
      return new Response("Failed to update profile", { status: 500 });
    }
  } else {
    console.error(`revenuecat-webhook: ignored event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy it and set its secrets**

Run: `npx supabase functions deploy revenuecat-webhook`
Then set the secret (use the exact string generated in Task 1, Step 6):
`npx supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=<the string from Task 1 Step 6>`

Expected: deploy succeeds; `npx supabase secrets list` shows `REVENUECAT_WEBHOOK_AUTH_HEADER` set.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/revenuecat-webhook/index.ts
git commit -m "feat: add revenuecat-webhook edge function"
```

---

### Task 5: Bundle the RevenueCat Capacitor plugin

**Files:**
- Modify: `src/native-bridge.js`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces: `window.CapacitorPurchases` global (the RevenueCat `Purchases` class), consumed by Task 6's `index.html` code — same pattern as the existing `window.CapacitorHealth`.

- [ ] **Step 1: Install the dependency**

Run: `npm install @revenuecat/purchases-capacitor`
Expected: added under `"dependencies"` in `package.json` (same section as `capacitor-health`), not `devDependencies` — it ships inside the native app bundle.

- [ ] **Step 2: Expose it in `native-bridge.js`**

Modify `src/native-bridge.js` from:

```javascript
import { Health } from 'capacitor-health';

window.CapacitorHealth = Health;
```

to:

```javascript
import { Health } from 'capacitor-health';
import { Purchases } from '@revenuecat/purchases-capacitor';

window.CapacitorHealth = Health;
window.CapacitorPurchases = Purchases;
```

- [ ] **Step 3: Rebuild and sync to confirm the bundle still builds cleanly**

Run: `npm run sync`
Expected: exits 0 — `esbuild` bundles `native-bridge.js` with no errors, then `www/native-bridge.js` and `npx cap sync` both complete successfully.

- [ ] **Step 4: Commit**

```bash
git add src/native-bridge.js package.json package-lock.json
git commit -m "feat: bundle RevenueCat Capacitor plugin into native-bridge.js"
```

---

### Task 6: Client integration in `index.html`

**Files:**
- Modify: `index.html:68` (constants — add RevenueCat API keys after `COACH_PLAN_LINK`)
- Modify: `index.html:985` (Dashboard state — add purchase/restore state after `subscriptionTier`)
- Modify: `index.html:1609-1616` (`tierUpgradeButtons` — branch on `isNativeApp`, add purchase/restore handlers)
- Modify: `index.html:1907-1913` (free-plan CTA block — add the "Restaurar compras" button)
- Modify: `index.html:1928-1949` (`App()` — configure the RevenueCat SDK once a session exists, when native)

**Interfaces:**
- Consumes: `window.CapacitorPurchases` from Task 5 (`.configure()`, `.getOfferings()`, `.purchasePackage()`, `.restorePurchases()`), `isNativeApp` (`index.html:72`, unchanged), `loadPlan()` (`index.html:1170`, unchanged), `subscriptionPlans` (unchanged).

- [ ] **Step 1: Add the RevenueCat API key constants**

Modify `index.html`, right after the `COACH_PLAN_LINK` line:

```javascript
const COACH_PLAN_LINK = "https://buy.stripe.com/test_4gM3cw3JW07og6lbBK6oo01";
// RevenueCat public API keys (platform-specific, safe to embed client-side — same trust
// model as the Supabase anon key above). Filled in from the RevenueCat project created in
// docs/superpowers/plans/2026-07-16-iap-implementation.md Task 1, Step 2.
const REVENUECAT_API_KEYS = {
    ios: "REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY",
    android: "REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY",
};
```

- [ ] **Step 2: Add purchase/restore state to `Dashboard`**

Modify `index.html`, right after `const [subscriptionTier, setSubscriptionTier] = useState(null);`:

```javascript
    const [subscriptionTier, setSubscriptionTier] = useState(null);
    const [purchasingTier, setPurchasingTier] = useState(null);
    const [restoringPurchases, setRestoringPurchases] = useState(false);
```

- [ ] **Step 3: Branch `tierUpgradeButtons` and add the purchase/restore handlers**

Modify `index.html`, replacing the existing `tierUpgradeButtons` function:

```javascript
    function tierUpgradeButtons(size) {
        const cls = size === "sm"
            ? "text-[11px] bg-[#3DDCFF] text-[#06121A] font-medium rounded-lg px-3 py-1.5 hover:brightness-110 transition"
            : "text-center bg-[#3DDCFF] text-[#06121A] font-medium text-sm rounded-lg px-5 py-2.5 hover:brightness-110 transition";
        return subscriptionPlans
            .filter((p) => CLIENT_PLAN_LINKS[p.tier])
            .map((p) => React.createElement("a", { key: p.tier, href: `${CLIENT_PLAN_LINKS[p.tier]}?client_reference_id=${session.user.id}`, target: "_blank", rel: "noopener noreferrer", className: cls }, `${p.display_name} · $${Number(p.price_usd).toFixed(2)}/mes`));
    }
```

with:

```javascript
    async function handleNativePurchase(tier) {
        setPurchasingTier(tier);
        try {
            const offerings = await window.CapacitorPurchases.getOfferings();
            const pkg = offerings.current?.availablePackages?.find((p) => p.identifier === tier);
            if (!pkg) {
                console.error(`No se encontró el paquete de RevenueCat para el tier "${tier}".`);
                return;
            }
            await window.CapacitorPurchases.purchasePackage({ aPackage: pkg });
            // The webhook is normally near-instant, but retry loadPlan a few times in
            // case it lands a couple seconds after the purchase call resolves.
            for (let i = 0; i < 3; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                await loadPlan();
            }
        }
        catch (e) {
            if (!e?.userCancelled) {
                console.error("Compra fallida:", e);
            }
        }
        finally {
            setPurchasingTier(null);
        }
    }
    async function handleRestorePurchases() {
        setRestoringPurchases(true);
        try {
            await window.CapacitorPurchases.restorePurchases();
            await loadPlan();
        }
        catch (e) {
            console.error("No se pudieron restaurar las compras:", e);
        }
        finally {
            setRestoringPurchases(false);
        }
    }
    function tierUpgradeButtons(size) {
        const cls = size === "sm"
            ? "text-[11px] bg-[#3DDCFF] text-[#06121A] font-medium rounded-lg px-3 py-1.5 hover:brightness-110 transition"
            : "text-center bg-[#3DDCFF] text-[#06121A] font-medium text-sm rounded-lg px-5 py-2.5 hover:brightness-110 transition";
        if (isNativeApp) {
            return subscriptionPlans
                .filter((p) => ["basico", "pro", "elite"].includes(p.tier))
                .map((p) => React.createElement("button", {
                key: p.tier,
                disabled: purchasingTier === p.tier,
                onClick: () => handleNativePurchase(p.tier),
                className: cls,
            }, purchasingTier === p.tier ? "Procesando..." : `${p.display_name} · $${Number(p.price_usd).toFixed(2)}/mes`));
        }
        return subscriptionPlans
            .filter((p) => CLIENT_PLAN_LINKS[p.tier])
            .map((p) => React.createElement("a", { key: p.tier, href: `${CLIENT_PLAN_LINKS[p.tier]}?client_reference_id=${session.user.id}`, target: "_blank", rel: "noopener noreferrer", className: cls }, `${p.display_name} · $${Number(p.price_usd).toFixed(2)}/mes`));
    }
```

- [ ] **Step 4: Add the "Restaurar compras" button to the free-plan CTA block**

Modify `index.html`, the free-plan block (currently ends with the "Ya pagué, actualizar estado" button):

```javascript
                React.createElement("div", { className: "flex flex-col items-end gap-2 shrink-0" },
                    React.createElement("div", { className: "flex flex-wrap justify-end gap-1.5" }, tierUpgradeButtons("lg")),
                    React.createElement("button", { onClick: loadPlan, className: "text-[11px] text-slate-500 hover:text-slate-300 transition" }, "Ya pagué, actualizar estado"))))),
```

to:

```javascript
                React.createElement("div", { className: "flex flex-col items-end gap-2 shrink-0" },
                    React.createElement("div", { className: "flex flex-wrap justify-end gap-1.5" }, tierUpgradeButtons("lg")),
                    React.createElement("button", { onClick: loadPlan, className: "text-[11px] text-slate-500 hover:text-slate-300 transition" }, "Ya pagué, actualizar estado"),
                    isNativeApp && React.createElement("button", { onClick: handleRestorePurchases, disabled: restoringPurchases, className: "text-[11px] text-slate-500 hover:text-slate-300 transition" }, restoringPurchases ? "Restaurando..." : "Restaurar compras"))))),
```

- [ ] **Step 5: Configure the RevenueCat SDK once a session exists, natively**

Modify `index.html`'s `App()` function — add a new `useEffect` right after the existing session-restore one (after its closing `}, []);` on the line before `function persistSession(s) {`):

```javascript
    useEffect(() => {
        if (!isNativeApp || !session) return;
        const apiKey = window.Capacitor.getPlatform() === "ios" ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
        window.CapacitorPurchases.configure({ apiKey, appUserID: session.user.id }).catch((e) => {
            console.error("No se pudo configurar RevenueCat:", e);
        });
    }, [session]);
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, 44 tests — in particular, "every inline `<script>` block in index.html is syntactically valid JS" catches any mismatched paren/brace introduced by the edits above.

- [ ] **Step 7: Run the linter**

Run: `npm run lint`
Expected: 0 errors. New warnings are acceptable only if they're pre-existing ones already documented in `eslint.config.js`'s history (not new ones on the lines just touched) — if a new one appears on a touched line, fix it before moving on.

- [ ] **Step 8: Sync into the native projects**

Run: `npm run sync`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: wire RevenueCat purchases into the native app's upgrade flow"
```

---

## What's explicitly not in this plan

- Actually creating the App Store Connect / Play Console subscription products (Task 1, Step 4) — blocked on the Apple Developer Program / Google Play Console accounts, tracked as a separate store-submission blocker.
- Sandbox/real-device purchase testing — same blocker.
- Coach plan billing, IAP-specific pricing, and migrating the web checkout to RevenueCat — out of scope per the design spec.
