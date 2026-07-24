import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Same CORS/preflight requirement as delete-account/generate-diet-plan.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Same verified-identity pattern as delete-account.
async function getVerifiedClientId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

// Forwards the caller's own JWT to is_admin() (rather than checking the admins
// table directly with the service key) so there is a single source of truth
// for "who is an admin" -- the SQL function, not a second copy of the logic.
async function callerIsAdmin(authHeader: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

const ALLOWED_PREMIUM_SOURCES = ["paid", "comp_trainer", "trial"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const callerId = await getVerifiedClientId(authHeader);
  if (!callerId || !authHeader) return json({ message: "unauthorized" }, 401);
  if (!(await callerIsAdmin(authHeader))) return json({ message: "not_authorized" }, 403);

  let body: { email?: string; full_name?: string; premium_source?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ message: "invalid_json" }, 400);
  }

  const email = (body.email || "").trim();
  const fullName = body.full_name?.trim() || null;
  const premiumSource = body.premium_source ?? null;
  if (!email) return json({ message: "El correo es requerido." }, 400);
  if (premiumSource !== null && !ALLOWED_PREMIUM_SOURCES.includes(premiumSource)) {
    return json({ message: "invalid_premium_source" }, 400);
  }

  try {
    // GoTrue admin invite: creates the auth.users row (email unconfirmed until the
    // invite link is used) AND sends the invite email in one call. This fires the
    // existing handle_new_user() trigger, which creates the matching profiles row --
    // no manual insert into profiles needed here.
    const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const inviteData = await inviteRes.json().catch(() => ({}));
    if (!inviteRes.ok) {
      const message = inviteData?.msg || inviteData?.message || inviteData?.error_description || "No se pudo invitar al usuario.";
      return json({ message }, 502);
    }

    const newUserId = inviteData?.id;
    if (!newUserId) return json({ message: "La invitación no devolvió un id de usuario." }, 502);

    // Apply the admin's choices (name, plan) on top of whatever handle_new_user()/
    // start_trial_on_signup() defaulted -- e.g. overriding an auto-started trial with
    // comp_trainer for a face-to-face training client.
    const patchBody: Record<string, unknown> = { premium_source: premiumSource };
    if (premiumSource !== "trial") patchBody.trial_ends_at = null;
    if (fullName) patchBody.full_name = fullName;
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUserId}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      console.error(`Failed to patch profile ${newUserId}: ${patchRes.status} ${await patchRes.text()}`);
    }

    return json({ created: true, id: newUserId, email }, 200);
  } catch (err) {
    console.error("admin-create-client error:", err);
    return json({ message: "internal_error" }, 500);
  }
});
