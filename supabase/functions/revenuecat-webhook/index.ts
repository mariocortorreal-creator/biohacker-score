import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { mapRevenueCatEvent } from "../_shared/revenuecat-event-mapping.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REVENUECAT_WEBHOOK_AUTH_HEADER = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER")!;

// Returns whether the update succeeded, so the caller can return a non-2xx status and
// let RevenueCat retry delivery — logging alone isn't enough, an update failure must
// actually surface as a failed webhook response.
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
  // "Authorization header value" in the RevenueCat dashboard — not an HMAC signature
  // like Stripe's, so this is a plain equality check against that configured secret.
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
