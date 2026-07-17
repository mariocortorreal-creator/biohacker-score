import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyStripeSignature } from "../_shared/stripe-signature.mjs";
import { mapStripeStatusToCoachStatus, resolvePlanFromAmount } from "../_shared/plan-matching.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Coach plan: $20/mo flat, up to 25 clients, price_1TrTmVLb3yxBeQwgrgwMvW66 (existing Payment Link).
const COACH_PRICE_ID = "price_1TrTmVLb3yxBeQwgrgwMvW66";
const COACH_PRICE_CENTS = 2000;

// Client plans replace the old single $7.99/mo individual plan (never had paying
// customers, safe to retire outright). Real Stripe amounts confirmed against the
// actual Payment Links (básico price_1To7SuLb3yxBeQwgnfiEuRZF, pro
// price_1Tsnw2Lb3yxBeQwgiESzfDdN, elite price_1TsoCELb3yxBeQwg2az3dJJa) — a prior
// version of this file used placeholder amounts (999/1399/1999) that never matched a
// real checkout, so a paying client would have hit the unmatched-amount branch below
// and never received premium. These cents amounts must stay in sync with
// subscription_plans.price_usd — checkout.session.completed doesn't carry price/line-item
// info without an extra Stripe API call (same tradeoff already accepted for the coach
// plan above), so tier is matched by exact charged amount, same as the coach detection.
const TIER_AMOUNTS_CENTS: Record<string, number> = { basico: 799, pro: 1400, elite: 1900 };

// Returns whether the update succeeded, so the caller can return a non-2xx status and
// let Stripe retry delivery — logging alone isn't enough, an update failure must
// actually surface as a failed webhook response (same pattern as revenuecat-webhook).
async function updateProfile(
  filterColumn: string,
  filterValue: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${filterColumn}=eq.${filterValue}`, {
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
    console.error("Failed to update profile:", await res.text());
    return false;
  }
  return true;
}

// Coach-plan equivalent of updateProfile. Patches `coaches` instead of `profiles`, and
// surfaces two failure modes clearly in the function logs (never silently) because a
// coach's paying status gates premium access for every one of their clients:
//   - COACH_ACTIVATION_BLOCKED: the DB rejected the write (e.g. the 50-active-coach cap
//     trigger fired) — Mario needs to review the cap before this coach can go active.
//   - COACH_ROW_NOT_FOUND: the checkout matched no existing `coaches` row — coach signup
//     is manual, so this means the row wasn't created before the coach paid.
// Returns whether the write itself succeeded (res.ok) — the caller returns a non-2xx
// status so Stripe retries. COACH_ROW_NOT_FOUND is deliberately NOT treated as a failure
// here: the write succeeded, it just matched no row, which is an expected state given
// manual coach signup (see comment below) rather than something a retry would fix.
async function updateCoach(
  filterColumn: string,
  filterValue: string,
  patch: Record<string, unknown>,
  context: string
): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coaches?${filterColumn}=eq.${filterValue}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(
      `COACH_ACTIVATION_BLOCKED (${context}): failed to update coaches where ${filterColumn}=${filterValue}. ` +
        `Supabase responded ${res.status}: ${text}. Check the 50-active-coach cap and this coach's row manually.`
    );
    return false;
  }

  let rows: unknown[] = [];
  try {
    rows = JSON.parse(text);
  } catch {
    // ignore parse errors, treated as no match below
  }

  if (rows.length === 0) {
    console.error(
      `COACH_ROW_NOT_FOUND (${context}): no coaches row matched ${filterColumn}=${filterValue}. ` +
        `Coach signup is manual — make sure the coaches row is created before sending them the Payment Link.`
    );
  }

  return true;
}

async function tierForPriceId(priceId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_plans?stripe_price_id=eq.${priceId}&select=tier`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].tier : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  // Tracks whether every DB write this event triggered actually succeeded. A false here
  // must turn into a non-2xx response below — logging alone previously let a failed
  // profiles/coaches PATCH pass silently with a 200, so Stripe never retried and a paying
  // client could end up permanently stuck without premium.
  let updateOk = true;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        const resolved = resolvePlanFromAmount(session.amount_total, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS);

        if (resolved?.type === "coach") {
          if (userId) {
            updateOk = await updateCoach(
              "id",
              userId,
              {
                status: "active",
                subscription_tier: "standard",
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
              },
              "checkout.session.completed"
            );
          }
        } else if (resolved?.type === "client" && userId) {
          // Client plan (básico/pro/elite) — sets premium_source = 'paid' so is_premium()
          // actually unlocks access; the old code only set the legacy `plan` display
          // column here, which meant a real paying customer never got premium (never hit
          // production since nobody had completed this checkout yet).
          updateOk = await updateProfile("id", userId, {
            plan: "premium",
            premium_source: "paid",
            subscription_tier: resolved.tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            premium_since: new Date().toISOString(),
          });
        } else {
          console.error(
            `checkout.session.completed: amount_total ${session.amount_total} matched no known plan (coach=${COACH_PRICE_CENTS}, client tiers=${JSON.stringify(TIER_AMOUNTS_CENTS)}).`
          );
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;

        if (priceId === COACH_PRICE_ID) {
          const coachStatus = mapStripeStatusToCoachStatus(sub.status);
          if (coachStatus) {
            updateOk = await updateCoach(
              "stripe_customer_id",
              sub.customer,
              { status: coachStatus },
              "customer.subscription.updated"
            );
          }
        } else {
          const tier = priceId ? await tierForPriceId(priceId) : null;
          const isActive = ["active", "trialing"].includes(sub.status);
          if (tier) {
            updateOk = await updateProfile("stripe_customer_id", sub.customer, isActive
              ? { plan: "premium", premium_source: "paid", subscription_tier: tier }
              : { plan: "free", premium_source: null });
          } else {
            console.error(
              `customer.subscription.updated: price ${priceId} matched no coach or client plan for customer ${sub.customer}.`
            );
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;

        if (priceId === COACH_PRICE_ID) {
          updateOk = await updateCoach(
            "stripe_customer_id",
            sub.customer,
            { status: "canceled" },
            "customer.subscription.deleted"
          );
        } else {
          updateOk = await updateProfile("stripe_customer_id", sub.customer, { plan: "free", premium_source: null });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Internal error", { status: 500 });
  }

  if (!updateOk) {
    return new Response("Failed to update profile or coach record", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
