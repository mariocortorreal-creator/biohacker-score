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
