// Deterministic macro-target calculation (Mifflin-St Jeor) used by generate-diet-plan
// (supabase/functions/generate-diet-plan/index.ts) — the AI only fills in the menu
// content, it never computes these numbers, so this math has to be right on its own.
// Pure and side-effect-free, so it's testable under plain Node.

export const ACTIVITY_MULTIPLIERS = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

export function calculateMacroTargets({ weight_kg, height_cm, age, body_gender, activity_level, nutrition_goal }) {
  const bmr =
    body_gender === "female"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
      : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] ?? 1.375;
  const tdee = bmr * multiplier;

  let calorieTarget = tdee;
  if (nutrition_goal === "cut") calorieTarget -= 500;
  if (nutrition_goal === "bulk") calorieTarget += 300;
  calorieTarget = Math.round(calorieTarget);

  const proteinG = Math.round(weight_kg * 2.0);
  const proteinCals = proteinG * 4;
  const fatG = Math.round((calorieTarget * 0.28) / 9);
  const fatCals = fatG * 9;
  const carbsG = Math.max(0, Math.round((calorieTarget - proteinCals - fatCals) / 4));

  return { calorieTarget, proteinG, carbsG, fatG };
}
