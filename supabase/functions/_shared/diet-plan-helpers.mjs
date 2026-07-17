// Pure, side-effect-free logic extracted from generate-diet-plan
// (supabase/functions/generate-diet-plan/index.ts) so it's testable under plain Node
// without mocking Supabase or the Anthropic API. Anything that needs a network call
// (fetching plans/profile rows) stays in the edge function; this module only covers
// the decision logic applied to already-fetched data.

// Claude is asked to respond with only a JSON object, but in practice it sometimes
// wraps the output in ```json fences or adds a stray sentence before/after — this
// recovers the JSON object from whatever text actually came back. Throws (does not
// return null) on genuinely unparseable text, matching the try/catch already around
// this logic in the edge function.
export function parseMealPlanJSON(rawText) {
  let cleaned = (rawText ?? "").replace(/```json|```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// A profile's tier isn't always set directly (subscription_tier is null until a first
// real Stripe/RevenueCat event lands) — comp_trainer accounts (coach-granted premium,
// no billing tier of their own) are treated as elite; everyone else defaults to basico
// rather than leaving the quota check with no tier to look up at all.
export function resolveCurrentTier(profile) {
  return profile?.subscription_tier ?? (profile?.premium_source === "comp_trainer" ? "elite" : "basico");
}

// `plans` must already be sorted by price ascending (the edge function's query does
// this) — the "next tier" is simply the following entry, or null past the top tier.
export function findNextTier(plans, currentTier) {
  const idx = plans.findIndex((pl) => pl.tier === currentTier);
  return idx >= 0 && idx < plans.length - 1 ? plans[idx + 1] : null;
}

export function buildQuotaExceededPayload(plans, profile, usedThisMonth, quota) {
  const currentTier = resolveCurrentTier(profile);
  const next = findNextTier(plans, currentTier);
  return {
    quota_exceeded: true,
    current_tier: currentTier,
    used_this_month: usedThisMonth,
    quota,
    next_tier: next?.tier ?? null,
    next_tier_display_name: next?.display_name ?? null,
    next_tier_price: next?.price_usd ?? null,
  };
}
