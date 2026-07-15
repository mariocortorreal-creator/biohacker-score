import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Coach plan: $20/mo flat, up to 25 clients, price_1TrTmVLb3yxBeQwgrgwMvW66 (existing Payment Link).
const COACH_PRICE_ID = "price_1TrTmVLb3yxBeQwgrgwMvW66";
const COACH_PRICE_CENTS = 2000;

// Client plans replace the old single $7.99/mo individual plan (never had paying
// customers, safe to retire outright). These cents amounts must stay in sync with
// subscription_plans.price_usd — checkout.session.completed doesn't carry price/line-item
// info without an extra Stripe API call (same tradeoff already accepted for the coach
// plan above), so tier is matched by exact charged amount, same as the coach detection.
const TIER_AMOUNTS_CENTS: Record<string, number> = { basico: 999, pro: 1399, elite: 1999 };

async function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // timing-safe-ish compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function updateProfile(filterColumn: string, filterValue: string, patch: Record<string, unknown>) {
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
  }
}

// Coach-plan equivalent of updateProfile. Patches `coaches` instead of `profiles`, and
// surfaces two failure modes clearly in the function logs (never silently) because a
// coach's paying status gates premium access for every one of their clients:
//   - COACH_ACTIVATION_BLOCKED: the DB rejected the write (e.g. the 50-active-coach cap
//     trigger fired) — Mario needs to review the cap before this coach can go active.
//   - COACH_ROW_NOT_FOUND: the checkout matched no existing `coaches` row — coach signup
//     is manual, so this means the row wasn't created before the coach paid.
async function updateCoach(
  filterColumn: string,
  filterValue: string,
  patch: Record<string, unknown>,
  context: string
) {
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
    return;
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

function mapStripeStatusToCoachStatus(stripeStatus: string): "active" | "past_due" | "canceled" | null {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired") {
    return "canceled";
  }
  return null; // e.g. "incomplete" — not an actionable state yet, leave untouched
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        // Checkout Sessions don't carry price/line-item info by default (no extra Stripe
        // API call is wired up in this function), so which plan was bought is
        // distinguished by the fixed checkout amount. All Payment Links disallow promo
        // codes and have no automatic tax, so amount_total reliably equals the price.
        const isCoachPayment = session.amount_total === COACH_PRICE_CENTS;
        const matchedTier = Object.entries(TIER_AMOUNTS_CENTS).find(
          ([, cents]) => cents === session.amount_total
        )?.[0];

        if (isCoachPayment) {
          if (userId) {
            await updateCoach(
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
        } else if (matchedTier && userId) {
          // Client plan (básico/pro/elite) — sets premium_source = 'paid' so is_premium()
          // actually unlocks access; the old code only set the legacy `plan` display
          // column here, which meant a real paying customer never got premium (never hit
          // production since nobody had completed this checkout yet).
          await updateProfile("id", userId, {
            plan: "premium",
            premium_source: "paid",
            subscription_tier: matchedTier,
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
            await updateCoach(
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
            await updateProfile("stripe_customer_id", sub.customer, isActive
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
          await updateCoach(
            "stripe_customer_id",
            sub.customer,
            { status: "canceled" },
            "customer.subscription.deleted"
          );
        } else {
          await updateProfile("stripe_customer_id", sub.customer, { plan: "free", premium_source: null });
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

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
