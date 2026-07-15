// index.html has no bundler and no TypeScript checker (see CLAUDE.md), so a stray or
// missing paren in a deeply-nested React.createElement tree has historically only
// surfaced at runtime, in the browser, sometimes silently (a section just fails to
// render). This test parses (never executes) every inline <script> block so a broken
// paren/brace fails `npm test` immediately instead of shipping.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("every inline <script> block in index.html is syntactically valid JS", () => {
  const htmlPath = path.join(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((code) => code.trim().length > 0);

  assert.ok(blocks.length > 0, "expected at least one non-empty inline <script> block in index.html");

  blocks.forEach((code, i) => {
    assert.doesNotThrow(
      () => new vm.Script(code, { filename: `index.html <script> block #${i}` }),
      (err) =>
        new Error(
          `index.html <script> block #${i} failed to parse — likely a mismatched paren/brace ` +
            `from a hand-edit. Original error: ${err.message}`
        )
    );
  });
});
