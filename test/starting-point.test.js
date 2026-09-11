const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadBodyScale } = require("./lib/load-body-scale");

const {
  BODY_STAGE_FAT_PCT,
  bmrMifflinStJeor,
  leanMassKg,
  bmrKatchMcArdle,
  estimatedMetabolicAge,
  ACTIVITY_FACTORS,
  tdeeFromBmr,
  startingPointDiagnosis,
} = loadBodyScale();

// ---------- fat % table ----------

test("BODY_STAGE_FAT_PCT covers all six stages for both genders", () => {
  for (const gender of ["male", "female"]) {
    for (let stage = 1; stage <= 6; stage++) {
      const pct = BODY_STAGE_FAT_PCT[gender][stage];
      assert.ok(Number.isFinite(pct) && pct > 0 && pct < 60, `${gender} stage ${stage}: ${pct}`);
    }
  }
});

test("women carry more essential fat than men at every stage", () => {
  // Women carry ~10 points more essential fat, so the same visual stage means more fat.
  for (let stage = 1; stage <= 6; stage++) {
    assert.ok(BODY_STAGE_FAT_PCT.female[stage] > BODY_STAGE_FAT_PCT.male[stage], `stage ${stage}`);
  }
});

test("fat % rises with the fat axis and falls with the muscle axis", () => {
  const m = BODY_STAGE_FAT_PCT.male;
  assert.ok(m[1] < m[2] && m[2] < m[3] && m[3] < m[4], "fat axis 1<2<3<4");
  assert.ok(m[6] < m[5] && m[5] < m[2], "muscle axis 6<5<promedio");
});

// ---------- BMR ----------

test("bmrMifflinStJeor matches the published formula for a man", () => {
  // 80 kg, 175 cm, 35 y: 10*80 + 6.25*175 - 5*35 + 5 = 1723.75
  assert.equal(bmrMifflinStJeor(80, 175, 35, "male"), 1723.75);
});

test("bmrMifflinStJeor matches the published formula for a woman", () => {
  // 60 kg, 165 cm, 30 y: 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
  assert.equal(bmrMifflinStJeor(60, 165, 30, "female"), 1320.25);
});

test("bmrMifflinStJeor returns null when any input is missing or non-positive", () => {
  assert.equal(bmrMifflinStJeor(null, 175, 35, "male"), null);
  assert.equal(bmrMifflinStJeor(80, 0, 35, "male"), null);
  assert.equal(bmrMifflinStJeor(80, 175, 35, "other"), null);
});

test("leanMassKg and bmrKatchMcArdle follow their formulas", () => {
  assert.equal(leanMassKg(80, 25), 60);
  // 370 + 21.6 * 60 = 1666
  assert.equal(bmrKatchMcArdle(60), 1666);
  assert.equal(leanMassKg(null, 25), null);
  assert.equal(bmrKatchMcArdle(null), null);
});

// ---------- metabolic age ----------

test("estimatedMetabolicAge is higher than chronological age for an overweight body", () => {
  const age = estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: 3 });
  assert.ok(Number.isInteger(age), `expected integer, got ${age}`);
  assert.ok(age > 35, `expected > 35 for sobrepeso, got ${age}`);
});

test("estimatedMetabolicAge is lower than chronological age for a muscular body", () => {
  const age = estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: 6 });
  assert.ok(age < 35, `expected < 35 for musculoso, got ${age}`);
});

test("estimatedMetabolicAge never drifts more than 15 years from chronological age", () => {
  const obese = estimatedMetabolicAge({ weightKg: 130, heightCm: 170, age: 40, gender: "male", stage: 4 });
  const ripped = estimatedMetabolicAge({ weightKg: 95, heightCm: 180, age: 40, gender: "male", stage: 6 });
  assert.ok(obese <= 55, `obese drifted too far: ${obese}`);
  assert.ok(ripped >= 25, `ripped drifted too far: ${ripped}`);
});

test("estimatedMetabolicAge stays within 18 and 80", () => {
  assert.ok(estimatedMetabolicAge({ weightKg: 70, heightCm: 180, age: 19, gender: "male", stage: 6 }) >= 18);
  assert.ok(estimatedMetabolicAge({ weightKg: 120, heightCm: 160, age: 78, gender: "female", stage: 4 }) <= 80);
});

test("estimatedMetabolicAge returns null when the profile is incomplete", () => {
  assert.equal(estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: null, gender: "male", stage: 3 }), null);
  assert.equal(estimatedMetabolicAge({ weightKg: 80, heightCm: 175, age: 35, gender: "male", stage: null }), null);
});

// ---------- TDEE ----------

test("ACTIVITY_FACTORS uses the standard Harris-Benedict multipliers", () => {
  assert.equal(ACTIVITY_FACTORS.sedentario, 1.2);
  assert.equal(ACTIVITY_FACTORS.ligero, 1.375);
  assert.equal(ACTIVITY_FACTORS.moderado, 1.55);
  assert.equal(ACTIVITY_FACTORS.activo, 1.725);
  assert.equal(ACTIVITY_FACTORS.muy_activo, 1.9);
});

test("tdeeFromBmr multiplies by the activity factor and rounds to whole kcal", () => {
  assert.equal(tdeeFromBmr(1723.75, "moderado"), 2672);
  assert.equal(tdeeFromBmr(1723.75, "unknown"), null);
  assert.equal(tdeeFromBmr(null, "moderado"), null);
});

// ---------- the full diagnosis ----------

const fullProfile = {
  weightKg: 80, heightCm: 175, age: 35, gender: "male",
  currentStage: 2, targetStage: 5, activityLevel: "moderado",
};

test("startingPointDiagnosis assembles every number the first-minute card needs", () => {
  const d = startingPointDiagnosis(fullProfile);
  // Spread first: d.missing is built inside the VM sandbox, so deepStrictEqual against a
  // locally-built [] fails on cross-realm Array.prototype rather than on content (see the
  // same gotcha documented in test/metric-capture.test.js).
  assert.deepEqual([...d.missing], []);
  assert.equal(d.chronologicalAge, 35);
  assert.ok(Number.isInteger(d.metabolicAge));
  assert.ok(d.bmr > 1500 && d.bmr < 2000, `bmr ${d.bmr}`);
  assert.ok(d.tdee > d.bmr, "tdee must exceed bmr");
  assert.equal(d.fatPct, 22);
  assert.equal(d.direction, "recomp");
  assert.equal(d.directionLabel, "Perder grasa y ganar músculo");
});

test("startingPointDiagnosis names exactly what is missing instead of guessing", () => {
  const d = startingPointDiagnosis({ ...fullProfile, weightKg: null, activityLevel: "" });
  assert.deepEqual([...d.missing].sort(), ["activityLevel", "weightKg"]);
  assert.equal(d.bmr, null);
  assert.equal(d.metabolicAge, null);
});

test("startingPointDiagnosis returns null for a null profile", () => {
  assert.equal(startingPointDiagnosis(null), null);
});
