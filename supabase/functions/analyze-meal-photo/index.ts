import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parseMealPlanJSON, buildQuotaExceededPayload as buildQuotaExceededPayloadPure } from "../_shared/diet-plan-helpers.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Anthropic accepts these four; anything else is rejected before spending a call.
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// ~5MB of base64 (~3.75MB binary) — generous for a phone camera photo, cheap
// enough to reject client-side abuse before it reaches Anthropic.
const MAX_BASE64_LENGTH = 7_000_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    `subscription_plans?select=tier,display_name,price_usd,monthly_photo_scan_quota&order=price_usd.asc`
  );
  const profileRows = await sbGet(`profiles?id=eq.${clientId}&select=subscription_tier,premium_source`);
  return buildQuotaExceededPayloadPure(plans, profileRows?.[0], usedThisMonth, quota);
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
    // 1. Nutrición es pestaña premium — mismo gate que generate-diet-plan
    const isPremium = await sbRpc("is_premium", { profile_id: clientId });
    if (isPremium !== true) return json({ error: "not_premium" }, 403);

    // 2. Cuota de escaneos según tier (trial->5, comp_trainer->elite ya resuelto en la función SQL)
    const quota = await sbRpc("get_client_meal_scan_quota", { profile_id: clientId });

    // 3. Escaneos ya usados este mes calendario
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const existing = await sbGet(
      `meal_photo_scans?client_id=eq.${clientId}&created_at=gte.${monthStart.toISOString()}&select=id`
    );
    const usedThisMonth = Array.isArray(existing) ? existing.length : 0;

    if (usedThisMonth >= quota) {
      return json(await buildQuotaExceededPayload(clientId, usedThisMonth, quota), 200);
    }

    // 4. Validar la imagen recibida
    let payload: { image_base64?: string; media_type?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "invalid_request_body" }, 400);
    }
    const { image_base64: imageBase64, media_type: mediaType } = payload;
    if (!imageBase64 || !mediaType) {
      return json({ error: "missing_image" }, 400);
    }
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return json({ error: "unsupported_media_type" }, 400);
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return json({ error: "image_too_large" }, 400);
    }

    // 5. Claude identifica alimentos y estima macros — foto 2D, sin objeto de
    // referencia de escala, así que esto es SIEMPRE un estimado aproximado,
    // nunca una medición. El prompt y la UI deben dejarlo explícito (política
    // de cero-fabricación de la marca) — ver ANALISIS-FACTIBILIDAD-MACRO-CAMARA.md.
    if (!ANTHROPIC_API_KEY) {
      return json({ error: "anthropic_key_missing" }, 500);
    }

    const prompt = `Eres un asistente de nutrición. Analiza esta foto de comida y estima sus macros.

Sé honesto sobre la incertidumbre: no tienes forma de medir el peso o volumen real de la porción a partir de una sola foto 2D, así que tu estimado será aproximado, no una medición de laboratorio. Indica tu nivel de confianza por alimento.

Responde ÚNICAMENTE con un objeto JSON. Sin markdown, sin explicaciones, sin texto antes o después. Usa exactamente esta estructura:
{"detected_items":[{"nombre":"","porcion_estimada":"","confianza":"alta|media|baja"}],"calorias":0,"proteina_g":0,"carbos_g":0,"grasa_g":0}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        // Same truncation risk documented in generate-diet-plan: adaptive
        // thinking would eat into max_tokens before the JSON is written out.
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return json({ error: "analysis_failed" }, 502);
    }

    const anthropicData = await anthropicRes.json();
    if (anthropicData.stop_reason === "max_tokens") {
      console.error("Claude output truncated at max_tokens:", JSON.stringify(anthropicData).slice(0, 500));
      return json({ error: "invalid_analysis_output" }, 502);
    }
    const textBlock = (anthropicData.content ?? []).find((b: any) => b.type === "text");

    let analysis: {
      detected_items?: unknown;
      calorias?: number;
      proteina_g?: number;
      carbos_g?: number;
      grasa_g?: number;
    };
    try {
      analysis = parseMealPlanJSON(textBlock?.text);
    } catch (parseErr) {
      console.error("Failed to parse Claude output as JSON:", parseErr, "raw text:", textBlock?.text);
      return json({ error: "invalid_analysis_output" }, 502);
    }

    // 6. Guardar — _final arranca igual a _est (ver update_meal_scan_correction
    // para cómo el cliente corrige después sin pisar el estimado original).
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/meal_photo_scans`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_id: clientId,
        detected_items: analysis.detected_items ?? [],
        calories_est: analysis.calorias ?? 0,
        protein_g_est: analysis.proteina_g ?? 0,
        carbs_g_est: analysis.carbos_g ?? 0,
        fat_g_est: analysis.grasa_g ?? 0,
        calories_final: analysis.calorias ?? 0,
        protein_g_final: analysis.proteina_g ?? 0,
        carbs_g_final: analysis.carbos_g ?? 0,
        fat_g_final: analysis.grasa_g ?? 0,
      }),
    });

    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      if (errBody.includes("Cuota mensual de escaneos de comida")) {
        return json(await buildQuotaExceededPayload(clientId, usedThisMonth, quota), 200);
      }
      console.error("meal_photo_scans insert failed:", insertRes.status, errBody);
      return json({ error: "internal_error" }, 500);
    }

    const inserted = await insertRes.json();
    return json({ meal_scan: Array.isArray(inserted) ? inserted[0] : inserted }, 200);
  } catch (err) {
    console.error("analyze-meal-photo error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
