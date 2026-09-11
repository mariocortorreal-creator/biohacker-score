// Same VM-slice approach as load-scoring-engine.js, for the body-composition section:
// the six-stage scale, its fat/muscle axes, and the goal direction derived from them.
// Exports defensively so a test for something not written yet fails on its assertion.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START_MARKER = "// ---------- Body composition -> nutrition direction ----------";
const END_MARKER = "// ---------- 7-day protocols (premium, editable here) ----------";

const EXPORT_NAMES = [
  "BODY_STAGE_AXES",
  "BODY_SCALE_VERSION",
  "goalDirectionFromBody",
  "migrateBodyStageV1ToV2",
  "GOAL_DIRECTION_LABELS",
  "suggestedGoals",
  "BODY_STAGE_FAT_PCT",
  "bmrMifflinStJeor",
  "leanMassKg",
  "bmrKatchMcArdle",
  "estimatedMetabolicAge",
  "ACTIVITY_FACTORS",
  "tdeeFromBmr",
  "startingPointDiagnosis",
];

function loadBodyScale() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "load-body-scale: could not find the expected section markers in index.html " +
        `("${START_MARKER}" .. "${END_MARKER}") — did the section comments move or get renamed?`
    );
  }

  const code = html.slice(start, end);
  const sandbox = { DEFAULT_GOALS: { sleepHours: 8, fastingHours: 16, exerciseMinutes: 45, stressMax: 3 } };
  vm.createContext(sandbox);
  const exportPairs = EXPORT_NAMES.map(
    (name) => `${name}: typeof ${name} !== "undefined" ? ${name} : undefined`
  ).join(", ");
  vm.runInContext(
    code + `\nglobalThis.__exports = { ${exportPairs} };`,
    sandbox,
    { filename: "index.html (body scale slice)" }
  );
  return sandbox.__exports;
}

module.exports = { loadBodyScale };
