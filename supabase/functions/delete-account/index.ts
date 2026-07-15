import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Same CORS/preflight requirement as generate-diet-plan — called directly from the
// browser with an Authorization header, so the browser's OPTIONS preflight must be
// answered here.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Same verified-identity pattern as generate-diet-plan: ask GoTrue to check the
// token's signature rather than trusting an unverified decoded claim. This also means
// a caller can only ever delete the account the token actually belongs to — there is
// no parameter for a target user id.
async function getVerifiedClientId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Best-effort delete: a table that doesn't have a matching row (or doesn't apply to
// this user, e.g. they were never a coach) should not abort the whole account deletion,
// so failures here are logged, not thrown.
async function sbDelete(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) {
    console.error(`DELETE ${path} failed: ${res.status} ${await res.text()}`);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await getVerifiedClientId(req.headers.get("Authorization"));
  if (!userId) return json({ error: "unauthorized" }, 401);

  try {
    // Wipe every table that isn't already covered by an `on delete cascade` FK to
    // profiles/auth.users. Redundant where a cascade does exist (the delete just
    // affects 0 rows), but this repo's earliest tables predate any migration file, so
    // cascade behavior on them can't be confirmed from the SQL history alone — safer
    // to delete explicitly than to assume.
    //
    // Children before parents: routine_assignments before routines/coaches,
    // coach-owned data before the coaches row, everything before profiles, and
    // profiles before the auth.users record itself.
    const ownRoutines = await sbGet(`routines?coach_id=eq.${userId}&select=id`);
    const routineIds = Array.isArray(ownRoutines) ? ownRoutines.map((r: any) => r.id) : [];
    if (routineIds.length > 0) {
      await sbDelete(`routine_assignments?routine_id=in.(${routineIds.join(",")})`);
    }
    await sbDelete(`routine_assignments?client_id=eq.${userId}`);
    await sbDelete(`routines?coach_id=eq.${userId}`);
    await sbDelete(`coach_clients?coach_id=eq.${userId}`);
    await sbDelete(`coach_clients?client_id=eq.${userId}`);
    await sbDelete(`coaches?id=eq.${userId}`);
    await sbDelete(`diet_plans?client_id=eq.${userId}`);
    await sbDelete(`client_food_exclusions?client_id=eq.${userId}`);
    await sbDelete(`daily_entries?user_id=eq.${userId}`);
    await sbDelete(`profiles?id=eq.${userId}`);

    // Finally, remove the actual auth account via the GoTrue admin API. Once this
    // succeeds the caller's access/refresh tokens stop working, so this must be last.
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!authRes.ok) {
      const errText = await authRes.text();
      console.error(`Failed to delete auth user ${userId}: ${authRes.status} ${errText}`);
      return json({ error: "auth_delete_failed" }, 502);
    }

    return json({ deleted: true }, 200);
  } catch (err) {
    console.error("delete-account error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
