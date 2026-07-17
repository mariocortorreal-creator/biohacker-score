// index.html has no build step and no module system (see CLAUDE.md): every function
// lives inline in one <script> block, addressed by global name, not exported. This
// mirrors load-scoring-engine.js: slice out just the "Static content cache" section
// (bounded by the section-comment markers already present in index.html) and
// evaluate that slice in an isolated VM context, so this stays testable under plain
// Node with no browser and no DOM/localStorage/fetch globals required at load time.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const START_MARKER = "// ---------- Static content cache ----------";
const END_MARKER = "// ---------- End static content cache ----------";

const EXPORT_NAMES = ["cachedFetchJSON", "STATIC_CACHE_TTL_MS"];

function loadStaticCache() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "load-static-cache: could not find the expected section markers in index.html " +
        `("${START_MARKER}" .. "${END_MARKER}") — did the section comments move or get renamed?`
    );
  }

  const code = html.slice(start, end);
  const sandbox = { Promise, Date, JSON };
  vm.createContext(sandbox);
  vm.runInContext(
    code + `\nglobalThis.__exports = { ${EXPORT_NAMES.join(", ")} };`,
    sandbox,
    { filename: "index.html (static cache slice)" }
  );
  return sandbox.__exports;
}

module.exports = { loadStaticCache };
