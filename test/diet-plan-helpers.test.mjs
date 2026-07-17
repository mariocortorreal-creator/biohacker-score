import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMealPlanJSON,
  resolveCurrentTier,
  findNextTier,
  buildQuotaExceededPayload,
} from "../supabase/functions/_shared/diet-plan-helpers.mjs";

test("parseMealPlanJSON parses a clean JSON object", () => {
  const result = parseMealPlanJSON('{"desayuno":{"nombre":"Avena"}}');
  assert.deepEqual(result, { desayuno: { nombre: "Avena" } });
});

test("parseMealPlanJSON strips ```json markdown fences", () => {
  const result = parseMealPlanJSON('```json\n{"desayuno":{"nombre":"Avena"}}\n```');
  assert.deepEqual(result, { desayuno: { nombre: "Avena" } });
});

test("parseMealPlanJSON extracts the JSON object from surrounding prose", () => {
  const result = parseMealPlanJSON(
    'Aquí está tu plan:\n{"desayuno":{"nombre":"Avena"}}\n¡Espero que te sirva!'
  );
  assert.deepEqual(result, { desayuno: { nombre: "Avena" } });
});

test("parseMealPlanJSON throws on genuinely unparseable text", () => {
  assert.throws(() => parseMealPlanJSON("Lo siento, no puedo generar un plan."));
});

test("parseMealPlanJSON throws on missing/undefined text", () => {
  assert.throws(() => parseMealPlanJSON(undefined));
});

test("resolveCurrentTier uses subscription_tier when set", () => {
  assert.equal(resolveCurrentTier({ subscription_tier: "pro", premium_source: "paid" }), "pro");
});

test("resolveCurrentTier maps comp_trainer with no tier to elite", () => {
  assert.equal(resolveCurrentTier({ subscription_tier: null, premium_source: "comp_trainer" }), "elite");
});

test("resolveCurrentTier defaults to basico for anyone else with no tier set", () => {
  assert.equal(resolveCurrentTier({ subscription_tier: null, premium_source: "trial" }), "basico");
  assert.equal(resolveCurrentTier(null), "basico");
});

const PLANS = [
  { tier: "basico", display_name: "Básico", price_usd: 7.99 },
  { tier: "pro", display_name: "Pro", price_usd: 14.0 },
  { tier: "elite", display_name: "Elite", price_usd: 19.0 },
];

test("findNextTier returns the next plan up when one exists", () => {
  assert.deepEqual(findNextTier(PLANS, "basico"), PLANS[1]);
});

test("findNextTier returns null for the top tier (nothing above elite)", () => {
  assert.equal(findNextTier(PLANS, "elite"), null);
});

test("findNextTier returns null for a tier that isn't in the plans list", () => {
  assert.equal(findNextTier(PLANS, "nonexistent"), null);
});

test("buildQuotaExceededPayload assembles the full upsell shape for a mid-tier client", () => {
  const payload = buildQuotaExceededPayload(PLANS, { subscription_tier: "basico" }, 3, 3);
  assert.deepEqual(payload, {
    quota_exceeded: true,
    current_tier: "basico",
    used_this_month: 3,
    quota: 3,
    next_tier: "pro",
    next_tier_display_name: "Pro",
    next_tier_price: 14.0,
  });
});

test("buildQuotaExceededPayload leaves next_tier fields null for an elite client (nothing to upsell to)", () => {
  const payload = buildQuotaExceededPayload(PLANS, { subscription_tier: "elite" }, 10, 10);
  assert.equal(payload.next_tier, null);
  assert.equal(payload.next_tier_display_name, null);
  assert.equal(payload.next_tier_price, null);
});
