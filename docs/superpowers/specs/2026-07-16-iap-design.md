# In-App Purchase (IAP) for the native app — Design

Date: 2026-07-16
Status: Approved by Mario, ready for implementation planning

## Why

Biohacker Score's client billing today is a Stripe Payment Link
(`CLIENT_PLAN_LINKS` in `index.html`), opened from inside the native
iOS/Android app via an external browser tab. Mario's primary market is
LatAm. Outside the US, Apple's App Store guidelines require digital
subscriptions to go through In-App Purchase — the external-payment-link
entitlement Apple granted after *Epic v. Apple* is specific to the US
storefront and does not apply here. Google Play's Alternative Billing
program is similarly not confirmed available in LatAm. Shipping the app
to the App Store/Play Store as-is risks rejection under guideline 3.1.1.

This spec covers adding real IAP to the native app so it can be
submitted for review. It does not cover the App Store Connect / Google
Play Console account setup (tracked separately as a store-submission
blocker) or actually building the store product listings.

## Decisions made (in order)

1. **RevenueCat, not a from-scratch StoreKit2 + Play Billing
   integration.** RevenueCat's Capacitor SDK unifies both platforms
   behind one API, handles receipt validation server-side on their end,
   and delivers a webhook when subscription state changes. This is a
   solo-developer project; building and maintaining custom receipt
   validation plus Apple Server Notifications V2 and Google
   Real-time Developer Notifications ourselves is meaningfully more
   risk on a payments-critical path for no benefit here. Free tier
   covers up to $2.5k/mo tracked revenue.
2. **Stripe stays for web, RevenueCat/IAP only inside the native app.**
   `biohackerlatino.com/precios` and its Stripe Payment Links are
   unchanged. Only the native app's upgrade buttons switch to IAP. A
   user can end up premium via either channel; `is_premium()` already
   doesn't care which.
3. **Only the 3 client tiers (básico/pro/elite) go through IAP.** The
   coach plan ($20/mo) stays manual/Stripe as already decided
   previously — no self-serve coach billing yet.
4. **Same prices as Stripe** ($7.99 / $14.00 / $19.00), for now. Apple/
   Google's cut (~15-30%) is accepted rather than passed on with
   IAP-specific pricing, to keep cross-channel pricing simple and
   consistent. Revisit once there's real usage data per channel.
5. **Same 10-day free trial as the web offer**, configured natively at
   the product level in App Store Connect / Play Console (no extra
   app-side logic needed for the trial itself).

## Architecture

Two payment paths, each owning its own platform, both converging on the
same `profiles` table and the same `is_premium()`:

```
Web (biohackerlatino.com/precios)          Native app (iOS/Android)
        │                                          │
   Stripe Payment Link                    RevenueCat SDK (Capacitor)
        │                                          │
        ▼                                          ▼
 stripe-webhook (existing,               revenuecat-webhook (new)
 unchanged)                                         │
        │                                          │
        └──────────────┬───────────────────────────┘
                        ▼
              public.profiles (premium_source, subscription_tier)
                        │
                        ▼
                  is_premium() — unchanged
```

`revenuecat-webhook` is the only place RevenueCat data touches the
database, mirroring how `stripe-webhook` already works.

## Data model changes

Deliberately minimal — `is_premium()` and the `premium_source` check
are not touched.

- New column: `profiles.payment_platform` (`'stripe' | 'apple_iap' |
  'google_iap'`, nullable). Informational only (support/analytics),
  never read by `is_premium()`.
- No new customer-id mapping table. RevenueCat is configured with
  `appUserID: session.user.id` (the Supabase user id) at SDK init, so
  every RevenueCat webhook already arrives with the correct
  `profile_id` — no separate identity mapping to maintain.
- No product-id → tier mapping table either. RevenueCat Entitlements
  are named to match the tier slugs directly (`basico`, `pro`, `elite`)
  in the RevenueCat dashboard, so the tier is whichever of those three
  slugs appears in the webhook's `entitlement_ids` array — the three
  client tiers are mutually exclusive (a profile only ever holds one),
  so exactly one is expected to match.

## Client integration (`index.html`)

Follows the existing `isNativeApp &&` gating pattern already used for
Health/Health Connect sync — same file, same convention, no new pattern
introduced:

- New dependency: `@revenuecat/purchases-capacitor` (official plugin).
- On session restore, if `isNativeApp`, configure the RevenueCat SDK
  once with `appUserID: session.user.id`.
- In the upgrade-CTA section that currently renders `CLIENT_PLAN_LINKS`
  as `<a href>` buttons: if `isNativeApp`, render the offerings/packages
  returned by RevenueCat's `getOfferings()` instead, each wired to
  `purchasePackage()`. If not native (plain browser), unchanged.
- After a successful purchase, call the existing `loadPlan()` a few
  times over the following seconds (webhook delivery is normally
  near-instant; this covers the rare lag without building an optimistic
  local-state system).
- Add a **"Restaurar compras"** button (Apple guideline requirement)
  near the existing account-settings UI, calling the SDK's
  `restorePurchases()`.
- No change needed to gate the paywall itself: the existing `isPremium
  &&` check already hides upgrade CTAs from anyone already premium,
  regardless of which channel granted it.

## Server reconciliation (`supabase/functions/revenuecat-webhook`)

New Edge Function, same shape as `stripe-webhook`:

- Auth: compares the request's `Authorization` header against a shared
  secret (`REVENUECAT_WEBHOOK_AUTH_HEADER`) configured in the
  RevenueCat dashboard — RevenueCat webhooks use a static shared
  secret, not an HMAC signature like Stripe's.
- Events that grant/renew access — `INITIAL_PURCHASE`, `RENEWAL`,
  `PRODUCT_CHANGE`, `UNCANCELLATION` — update `profiles`:
  `premium_source = 'paid'`, `subscription_tier` set to whichever known
  tier slug (`basico`/`pro`/`elite`) appears in `entitlement_ids`,
  `payment_platform` derived from `event.store` (`app_store` →
  `apple_iap`, `play_store` → `google_iap`).
- `EXPIRATION` revokes: `premium_source = null` (mirrors
  `stripe-webhook`'s handling of `customer.subscription.deleted`).
- `CANCELLATION` alone does **not** revoke access — the user keeps
  access through the end of the paid period; RevenueCat sends
  `EXPIRATION` separately once it actually lapses.
- Any other event type: logged and ignored, same `default: break`
  convention as `stripe-webhook`.
- No idempotency bookkeeping needed: handlers set state from the
  current event rather than accumulating, so redelivery is naturally
  safe — same reasoning already relied on in `stripe-webhook`.
- Pure event-interpretation logic (event type + entitlement + store →
  the profile patch to apply, or "ignore") lives in a shared,
  side-effect-free module — `supabase/functions/_shared/
  revenuecat-event-mapping.mjs` — importable from both the Deno
  function and Node tests, following the pattern already established
  for `stripe-signature.mjs` / `plan-matching.mjs` / `diet-macros.mjs`.

## Error handling / edge cases

- **Webhook delivery lag after a purchase**: covered by the client's
  short `loadPlan()` retry loop above; no server-side special-casing.
- **Already premium via Stripe, opens native app**: no paywall shown —
  already covered by the existing `isPremium` gate, no new code.
- **Cancels from OS settings, not in-app**: resolved automatically by
  the `EXPIRATION` webhook at period end.
- **Webhook handler errors**: return non-2xx so RevenueCat retries
  delivery automatically, same reliance already placed on Stripe's
  retry behavior.

## Testing

- **Unit tests** (Node, `node --test`, matching the existing
  `test/*.test.mjs` pattern): cover
  `revenuecat-event-mapping.mjs` — which event types grant/revoke
  access, that unknown event types are ignored, and a regression guard
  that `CANCELLATION` alone never revokes access.
- **Sandbox testing** (StoreKit Sandbox / Play Billing internal
  testing track) requires the Apple Developer Program and Google Play
  Console accounts, both still pending as a separate store-submission
  blocker. The architecture and unit tests here don't depend on those
  accounts existing; real end-to-end purchase testing does.

## Explicitly out of scope

- Coach plan ($20/mo) billing — stays manual, unchanged.
- IAP-specific pricing different from Stripe's.
- Migrating the web checkout to RevenueCat.
- Handling Apple/Google forced refunds as a distinct case beyond the
  standard `EXPIRATION` path (revisit if it turns out to need special
  handling once real usage exists).
