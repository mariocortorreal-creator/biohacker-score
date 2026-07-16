import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMacroTargets } from "../supabase/functions/_shared/diet-macros.mjs";

const BASE_PROFILE = {
  weight_kg: 80,
  height_cm: 180,
  age: 30,
  body_gender: "male",
  activity_level: "moderado",
  nutrition_goal: "maintain",
};

test("calculateMacroTargets computes BMR/TDEE via Mifflin-St Jeor for a male profile", () => {
  const result = calculateMacroTargets(BASE_PROFILE);
  // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  // TDEE = 1780 * 1.55 (moderado) = 2759
  assert.equal(result.calorieTarget, 2759);
});

test("calculateMacroTargets subtracts the female offset instead of adding it", () => {
  const male = calculateMacroTargets(BASE_PROFILE);
  const female = calculateMacroTargets({ ...BASE_PROFILE, body_gender: "female" });
  // Female BMR uses -161 instead of +5, a 166 kcal swing before the activity multiplier
  assert.ok(female.calorieTarget < male.calorieTarget);
});

test("calculateMacroTargets applies a 500 kcal deficit for cut", () => {
  const maintain = calculateMacroTargets(BASE_PROFILE);
  const cut = calculateMacroTargets({ ...BASE_PROFILE, nutrition_goal: "cut" });
  assert.equal(maintain.calorieTarget - cut.calorieTarget, 500);
});

test("calculateMacroTargets applies a 300 kcal surplus for bulk", () => {
  const maintain = calculateMacroTargets(BASE_PROFILE);
  const bulk = calculateMacroTargets({ ...BASE_PROFILE, nutrition_goal: "bulk" });
  assert.equal(bulk.calorieTarget - maintain.calorieTarget, 300);
});

test("calculateMacroTargets falls back to a sedentary-ish multiplier for an unknown activity level", () => {
  const known = calculateMacroTargets({ ...BASE_PROFILE, activity_level: "ligero" });
  const unknown = calculateMacroTargets({ ...BASE_PROFILE, activity_level: "not_a_real_level" });
  // Unknown activity levels fall back to the "ligero" multiplier (1.375) — same result.
  assert.equal(unknown.calorieTarget, known.calorieTarget);
});

test("calculateMacroTargets sets protein at 2g per kg bodyweight", () => {
  const result = calculateMacroTargets(BASE_PROFILE);
  assert.equal(result.proteinG, 160); // 80kg * 2.0
});

test("calculateMacroTargets floors carbs at 0 when protein+fat calories would exceed the target", () => {
  // Chosen so protein (2g/kg, independent of calorie target) plus fat calories actually
  // exceed calorieTarget before clamping (raw carbsG works out to -1) — a real regression
  // guard for the Math.max(0, ...) floor, not just an assertion that happens to pass.
  const result = calculateMacroTargets({
    weight_kg: 200,
    height_cm: 140,
    age: 90,
    body_gender: "female",
    activity_level: "sedentario",
    nutrition_goal: "cut",
  });
  assert.equal(result.carbsG, 0);
});
