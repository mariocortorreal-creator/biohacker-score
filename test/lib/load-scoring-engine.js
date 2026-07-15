// index.html has no build step and no module system (see CLAUDE.md): every function
// lives inline in one <script> block, addressed by global name, not exported. To unit
// test the pure scoring functions without turning this into a bundled project, this
// helper slices out just the "Scoring engine" / "Streaks" section (bounded by the
// section-comment markers already present in index.html) and evaluates that slice in
// an isolated VM context — the rest of the app (React tree, Supabase calls, DOM) is
// never touched, so this stays safe to run under plain Node with no browser.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START_MARKER = "// ---------- Scoring engine ----------";
const END_MARKER = "// ---------- Recommendation engine ----------";

const EXPORT_NAMES = [
  "clamp",
  "sleepScore",
  "nutritionScore",
  "exerciseScore",
  "stressScore",
  "totalScore",
  "scoreColor",
  "computeStreak",
  "weeklyComparison",
  "DEFAULT_GOALS",
];

function loadScoringEngine() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "load-scoring-engine: could not find the expected section markers in index.html " +
        `("${START_MARKER}" .. "${END_MARKER}") — did the section comments move or get renamed?`
    );
  }

  const code = html.slice(start, end);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    code + `\nglobalThis.__exports = { ${EXPORT_NAMES.join(", ")} };`,
    sandbox,
    { filename: "index.html (scoring engine slice)" }
  );
  return sandbox.__exports;
}

module.exports = { loadScoringEngine };
