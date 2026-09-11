const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadBodyScale } = require("./lib/load-body-scale");

const {
  BODY_STAGE_AXES,
  BODY_SCALE_VERSION,
  goalDirectionFromBody,
  migrateBodyStageV1ToV2,
  GOAL_DIRECTION_LABELS,
  adaptiveNoteApplies,
} = loadBodyScale();

// Stage numbers, for readability in the assertions below.
const DELGADO = 1;
const PROMEDIO = 2;
const SOBREPESO = 3;
const OBESIDAD = 4;
const ATLETICO = 5;
const MUSCULOSO = 6;

// ---------- the scale itself ----------

test("BODY_STAGE_AXES covers six stages, each with a fat and a muscle level", () => {
  const stages = Object.keys(BODY_STAGE_AXES).map(Number).sort((a, b) => a - b);
  assert.equal(stages.length, 6);
  assert.equal(stages[0], 1);
  assert.equal(stages[5], 6);
  for (const stage of stages) {
    const axes = BODY_STAGE_AXES[stage];
    assert.ok(Number.isInteger(axes.fat), `stage ${stage} needs an integer fat level`);
    assert.ok(Number.isInteger(axes.muscle), `stage ${stage} needs an integer muscle level`);
  }
});

test("the scale spans a real range of body fat, not just the athletic end", () => {
  // The old four-image scale ran from roughly 10% to 30% body fat, so nobody lean and
  // nobody obese could find themselves in it. Leanest and fattest must differ by at
  // least three steps for the six pictures to be visibly distinguishable.
  const fatLevels = Object.values(BODY_STAGE_AXES).map((a) => a.fat);
  assert.ok(
    Math.max(...fatLevels) - Math.min(...fatLevels) >= 3,
    `fat axis is too narrow: ${JSON.stringify(fatLevels)}`
  );
});

test("the scale has a muscle axis, which the old one lacked entirely", () => {
  const muscleLevels = Object.values(BODY_STAGE_AXES).map((a) => a.muscle);
  assert.ok(
    Math.max(...muscleLevels) - Math.min(...muscleLevels) >= 2,
    `muscle axis is too narrow: ${JSON.stringify(muscleLevels)}`
  );
});

test("the lean stage and the muscular stage are not the same body", () => {
  // "Definido" and "Atlético" in the old set were two pictures of one physique.
  const delgado = BODY_STAGE_AXES[DELGADO];
  const musculoso = BODY_STAGE_AXES[MUSCULOSO];
  assert.notEqual(delgado.muscle, musculoso.muscle);
});

// ---------- goal direction ----------

test("goalDirectionFromBody returns null until both ends are chosen", () => {
  assert.equal(goalDirectionFromBody(null, ATLETICO), null);
  assert.equal(goalDirectionFromBody(PROMEDIO, null), null);
});

test("dropping fat at the same muscle level is a cut", () => {
  assert.equal(goalDirectionFromBody(SOBREPESO, PROMEDIO), "cut");
  assert.equal(goalDirectionFromBody(OBESIDAD, SOBREPESO), "cut");
});

test("adding muscle without losing fat is a bulk", () => {
  assert.equal(goalDirectionFromBody(DELGADO, MUSCULOSO), "bulk");
});

test("losing fat while adding muscle is a recomposition, not a cut", () => {
  // This is the most common real goal — average person who wants to look athletic —
  // and the old scale collapsed it into "cut", which prescribes the wrong calories.
  assert.equal(goalDirectionFromBody(PROMEDIO, ATLETICO), "recomp");
  assert.equal(goalDirectionFromBody(OBESIDAD, ATLETICO), "recomp");
});

test("choosing the stage you already are is maintenance", () => {
  assert.equal(goalDirectionFromBody(PROMEDIO, PROMEDIO), "maintain");
  assert.equal(goalDirectionFromBody(MUSCULOSO, MUSCULOSO), "maintain");
});

test("every direction the function can return has a Spanish label", () => {
  const directions = new Set();
  for (let current = 1; current <= 6; current++) {
    for (let target = 1; target <= 6; target++) {
      const dir = goalDirectionFromBody(current, target);
      if (dir) directions.add(dir);
    }
  }
  for (const dir of directions) {
    assert.ok(
      typeof GOAL_DIRECTION_LABELS[dir] === "string" && GOAL_DIRECTION_LABELS[dir].length > 0,
      `"${dir}" has no label in GOAL_DIRECTION_LABELS`
    );
  }
});

// ---------- migrating the stored stages ----------

test("BODY_SCALE_VERSION is 2 now that the scale has six stages", () => {
  assert.equal(BODY_SCALE_VERSION, 2);
});

test("migrateBodyStageV1ToV2 maps every old stage onto the closest new one", () => {
  // Old scale: 1 Definido, 2 Atlético, 3 Promedio, 4 Sobre el promedio.
  assert.equal(migrateBodyStageV1ToV2(1), ATLETICO);
  assert.equal(migrateBodyStageV1ToV2(2), ATLETICO);
  assert.equal(migrateBodyStageV1ToV2(3), PROMEDIO);
  assert.equal(migrateBodyStageV1ToV2(4), SOBREPESO);
});

test("migrateBodyStageV1ToV2 leaves an unknown value alone instead of guessing", () => {
  assert.equal(migrateBodyStageV1ToV2(null), null);
  assert.equal(migrateBodyStageV1ToV2(9), null);
});

test("no old stage migrates onto obesity, which the old scale never depicted", () => {
  // The old set topped out around 30% body fat; inventing an obesity reading for a
  // stored profile would be fabricating data the user never entered.
  const migrated = [1, 2, 3, 4].map(migrateBodyStageV1ToV2);
  assert.ok(!migrated.includes(OBESIDAD), `unexpected obesity mapping: ${migrated}`);
});

test("adaptiveNoteApplies fires for recomp when the day had little or no exercise", () => {
  assert.equal(adaptiveNoteApplies("recomp", { exerciseMinutes: null }), true);
  assert.equal(adaptiveNoteApplies("recomp", { exerciseMinutes: 10 }), true);
});

test("adaptiveNoteApplies stays quiet for recomp on a trained day", () => {
  assert.equal(adaptiveNoteApplies("recomp", { exerciseMinutes: 45 }), false);
});
