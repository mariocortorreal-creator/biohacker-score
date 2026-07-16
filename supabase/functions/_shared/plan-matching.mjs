// Pure decision logic used by the Stripe webhook (supabase/functions/stripe-webhook/index.ts)
// to map raw Stripe event data onto this app's plan model, kept side-effect-free so it's
// testable under plain Node without mocking Supabase/Stripe network calls.

export function mapStripeStatusToCoachStatus(stripeStatus) {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired") {
    return "canceled";
  }
  return null; // e.g. "incomplete" — not an actionable state yet, leave untouched
}

// Checkout Sessions don't carry price/line-item info by default, so which plan was
// bought is distinguished by the fixed checkout amount (see stripe-webhook/index.ts for
// why: all Payment Links disallow promo codes and have no automatic tax, so amount_total
// reliably equals the price). Returns null when the amount matches no known plan.
export function resolvePlanFromAmount(amountTotal, coachPriceCents, tierAmountsCents) {
  if (amountTotal === coachPriceCents) {
    return { type: "coach" };
  }
  const matchedTier = Object.entries(tierAmountsCents).find(
    ([, cents]) => cents === amountTotal
  )?.[0];
  return matchedTier ? { type: "client", tier: matchedTier } : null;
}
