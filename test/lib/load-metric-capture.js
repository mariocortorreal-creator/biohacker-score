// Same slice-and-run-in-a-VM trick as load-scoring-engine.js (see the note there for why
// index.html can't just export things), but for the metric-capture helpers: the functions
// that turn what a user actually knows — the clock time they went to bed, the checkboxes
// they ticked — into the numbers the scoring engine already expects.
//
// Exports defensively (undefined instead of ReferenceError) so a test for a function that
// doesn't exist yet fails on its assertion rather than blowing up the whole file.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START_MARKER = "// ---------- Scoring engine ----------";
const END_MARKER = "// ---------- Recommendation engine ----------";

const EXPORT_NAMES = [
  "clamp",
  "clockToMinutes",
  "clockFromDb",
  "hoursBetweenClock",
  "sleepHoursFromClock",
  "fastingHoursFromClock",
  "nutritionQualityFromChecklist",
  "NUTRITION_CHECKLIST",
  "SLEEP_QUALITY_OPTIONS",
  "EXERCISE_INTENSITY_OPTIONS",
  "STRESS_LEVEL_OPTIONS",
];

function loadMetricCapture() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "load-metric-capture: could not find the expected section markers in index.html " +
        `("${START_MARKER}" .. "${END_MARKER}") — did the section comments move or get renamed?`
    );
  }

  const code = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  const exportPairs = EXPORT_NAMES.map(
    (name) => `${name}: typeof ${name} !== "undefined" ? ${name} : undefined`
  ).join(", ");
  vm.runInContext(
    code + `\nglobalThis.__exports = { ${exportPairs} };`,
    sandbox,
    { filename: "index.html (metric capture slice)" }
  );
  return sandbox.__exports;
}

module.exports = { loadMetricCapture };
