import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { calculateMacroTargets } from "../_shared/diet-macros.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Called directly from the browser, so the preflight OPTIONS request the browser sends
// ahead of a POST with Authorization/Content-Type headers must be answered here — without
// this, every real call from the app fails at the CORS preflight before the POST ever fires.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Resolves the calling user's id by asking Supabase Auth to verify the token's
// signature (GoTrue /auth/v1/user), instead of trusting an unverified base64-decoded
// `sub` claim. The project also enforces verify_jwt=true at the gateway, but that
// setting lives outside this repo (no supabase/config.toml), so this function no
// longer depends on it to stay safe.
async function getVerifiedClientId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbRpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`RPC ${fn} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function buildQuotaExceededPayload(clientId: string, usedThisMonth: number, quota: number) {
  const plans = await sbGet(
    `subscription_plans?select=tier,display_name,price_usd,monthly_diet_quota&order=price_usd.asc`
  );
  const profileRows = await sbGet(`profiles?id=eq.${clientId}&select=subscription_tier,premium_source`);
  const p = profileRows?.[0];
  const currentTier = p?.subscription_tier ?? (p?.premium_source === "comp_trainer" ? "elite" : "basico");
  const idx = plans.findIndex((pl: any) => pl.tier === currentTier);
  const next = idx >= 0 ? plans[idx + 1] : null;
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const clientId = await getVerifiedClientId(req.headers.get("Authorization"));
  if (!clientId) return json({ error: "unauthorized" }, 401);

  try {
    // 1. Nutrición es pestaña premium — cualquiera de los 3 planes, trial o comp_trainer la desbloquea
    const isPremium = await sbRpc("is_premium", { profile_id: clientId });
    if (isPremium !== true) return json({ error: "not_premium" }, 403);

    // 2. Cuota según tier (fallback trial->basico, comp_trainer->elite ya resuelto dentro de la función SQL)
    const quota = await sbRpc("get_client_diet_quota", { profile_id: clientId });

    // 3. Generaciones ya usadas este mes calendario
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const existing = await sbGet(
      `diet_plans?client_id=eq.${clientId}&generated_at=gte.${monthStart.toISOString()}&select=id`
    );
    const usedThisMonth = Array.isArray(existing) ? existing.length : 0;

    if (usedThisMonth >= quota) {
      return json(await buildQuotaExceededPayload(clientId, usedThisMonth, quota), 200);
    }

    // 4. Datos del cliente para la calculadora
    const profileRows = await sbGet(
      `profiles?id=eq.${clientId}&select=weight_kg,height_cm,age,body_gender,activity_level,nutrition_goal`
    );
    const profile = profileRows?.[0];
    if (!profile) return json({ error: "profile_not_found" }, 404);

    const required = ["weight_kg", "height_cm", "age", "body_gender", "activity_level", "nutrition_goal"];
    const missing = required.filter((k) => profile[k] === null || profile[k] === undefined);
    if (missing.length > 0) {
      return json({ error: "missing_calculator_inputs", missing }, 400);
    }

    const exclusions = await sbGet(`client_food_exclusions?client_id=eq.${clientId}&select=food_name,reason`);

    // 5. Cálculo determinístico (Mifflin-St Jeor) — la IA NO calcula números, solo arma el menú
    const { weight_kg, height_cm, age, body_gender, activity_level, nutrition_goal } = profile;
    const { calorieTarget, proteinG, carbsG, fatG } = calculateMacroTargets({
      weight_kg,
      height_cm,
      age,
      body_gender,
      activity_level,
      nutrition_goal,
    });

    // 6. Claude genera SOLO el contenido del menú, respetando los targets numéricos exactos
    if (!ANTHROPIC_API_KEY) {
      return json({ error: "anthropic_key_missing" }, 500);
    }

    const exclusionsList =
      (Array.isArray(exclusions) ? exclusions : [])
        .map((e: any) => `${e.food_name} (${e.reason === "allergy" ? "alergia" : "no le gusta"})`)
        .join(", ") || "ninguna";

    const goalEs =
      nutrition_goal === "cut" ? "pérdida de grasa" : nutrition_goal === "bulk" ? "ganancia muscular" : "mantenimiento";

    const prompt = `Genera un plan alimenticio de un día en español para un cliente de biohacking con estos objetivos EXACTOS (no los cambies):
- Calorías: ${calorieTarget} kcal
- Proteína: ${proteinG} g
- Carbohidratos: ${carbsG} g
- Grasa: ${fatG} g
- Objetivo: ${goalEs}
- Alimentos a evitar (alergias o preferencias, NO incluir bajo ninguna circunstancia): ${exclusionsList}

Distribuye en desayuno, almuerzo, cena y 1 snack. Máximo 4-5 alimentos por comida, nombres y porciones cortos y concretos (gramos). Los macros de las 4 comidas sumados deben acercarse a los targets de arriba (margen ±5%).

Responde ÚNICAMENTE con un objeto JSON. Sin markdown, sin explicaciones, sin razonar en voz alta, sin texto antes o después. Completa las 4 comidas por entero, no abrevies ni escribas "..." en el JSON. Usa exactamente esta estructura:
{"desayuno":{"nombre":"","alimentos":[{"item":"","porcion":""}],"calorias":0,"proteina_g":0,"carbos_g":0,"grasa_g":0},"almuerzo":{"nombre":"","alimentos":[{"item":"","porcion":""}],"calorias":0,"proteina_g":0,"carbos_g":0,"grasa_g":0},"cena":{"nombre":"","alimentos":[{"item":"","porcion":""}],"calorias":0,"proteina_g":0,"carbos_g":0,"grasa_g":0},"snacks":[{"nombre":"","alimentos":[{"item":"","porcion":""}],"calorias":0,"proteina_g":0,"carbos_g":0,"grasa_g":0}]}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 3000,
        // Sonnet 5 runs adaptive thinking by default when this is omitted, which was
        // consuming ~2970 of the 3000 max_tokens on reasoning and truncating the actual
        // JSON output (stop_reason: max_tokens -> invalid_generation_output). This is a
        // templated, deterministic menu-assembly task with no need for extended reasoning.
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return json({ error: "generation_failed", debug_detail: `status ${anthropicRes.status}: ${errText}`.slice(0, 800) }, 502);
    }

    const anthropicData = await anthropicRes.json();
    console.error("Anthropic usage debug:", JSON.stringify({ stop_reason: anthropicData.stop_reason, usage: anthropicData.usage }));
    if (anthropicData.stop_reason === "max_tokens") {
      console.error("Claude output truncated at max_tokens:", JSON.stringify(anthropicData).slice(0, 500));
      return json({ error: "invalid_generation_output", debug_detail: `truncated at max_tokens, usage: ${JSON.stringify(anthropicData.usage)}` }, 502);
    }
    const textBlock = (anthropicData.content ?? []).find((b: any) => b.type === "text");

    let mealPlan: unknown;
    try {
      let cleaned = (textBlock?.text ?? "").replace(/```json|```/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
      mealPlan = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Claude output as JSON:", parseErr, "raw text:", textBlock?.text);
      return json({ error: "invalid_generation_output", debug_detail: String(textBlock?.text ?? "").slice(0, 800) }, 502);
    }

    // 7. Guardar
    const inputSnapshot = {
      weight_kg,
      height_cm,
      age,
      body_gender,
      activity_level,
      nutrition_goal,
      exclusions: (Array.isArray(exclusions) ? exclusions : []).map((e: any) => ({
        food_name: e.food_name,
        reason: e.reason,
      })),
    };

    // Inserted via a direct fetch (not the generic sbInsert helper, which just
    // throws on !ok) so a rejection from trg_enforce_diet_plan_quota — which
    // re-checks the quota atomically at insert time and can reject a request that
    // passed the pre-check above under concurrent load — surfaces the same
    // quota_exceeded shape the pre-check returns, instead of a generic 500.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/diet_plans`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_id: clientId,
        calorie_target: calorieTarget,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
        meal_plan: mealPlan,
        input_snapshot: inputSnapshot,
      }),
    });

    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      if (errBody.includes("Cuota mensual de planes de alimentación")) {
        return json(await buildQuotaExceededPayload(clientId, usedThisMonth, quota), 200);
      }
      console.error("diet_plans insert failed:", insertRes.status, errBody);
      return json({ error: "internal_error" }, 500);
    }

    const inserted = await insertRes.json();
    return json({ diet_plan: Array.isArray(inserted) ? inserted[0] : inserted }, 200);
  } catch (err) {
    console.error("generate-diet-plan error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
