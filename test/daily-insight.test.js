const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScoringEngine } = require("./lib/load-scoring-engine");

const { dailyInsight, INSIGHT_KINDS, DEFAULT_GOALS } = loadScoringEngine();

function isoDaysAgo(n, from = "2026-09-10") {
  const d = new Date(from + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function entry(daysAgo, overrides) {
  return {
    entry_date: isoDaysAgo(daysAgo),
    sleep_hours: 7, sleep_quality: 7, fasting_hours: 14, nutrition_quality: 7,
    exercise_minutes: 30, exercise_intensity: 5, stress_level: 4,
    ...overrides,
  };
}
const TODAY = "2026-09-10";

test("dailyInsight returns null with no entries", () => {
  assert.equal(dailyInsight([], DEFAULT_GOALS, TODAY), null);
  assert.equal(dailyInsight(null, DEFAULT_GOALS, TODAY), null);
});

test("dailyInsight returns a well-formed insight for a single entry", () => {
  const insight = dailyInsight([entry(0)], DEFAULT_GOALS, TODAY);
  assert.ok(insight, "expected an insight");
  assert.ok(INSIGHT_KINDS.includes(insight.kind), `unknown kind ${insight.kind}`);
  assert.ok(typeof insight.text === "string" && insight.text.length > 10);
  assert.ok(["up", "down", "neutral"].includes(insight.tone));
});

test("dailyInsight is stable for the same data on the same day", () => {
  const entries = [entry(0), entry(1), entry(2)];
  const a = dailyInsight(entries, DEFAULT_GOALS, TODAY);
  const b = dailyInsight(entries, DEFAULT_GOALS, TODAY);
  assert.deepEqual(a, b);
});

test("dailyInsight varies across days for the same data when several insights apply", () => {
  // Enough history for streak, weekly comparison and sleep correlation to all be eligible.
  const entries = [];
  for (let i = 0; i < 14; i++) entries.push(entry(i, { sleep_hours: i % 2 ? 6 : 8, stress_level: i % 2 ? 7 : 3 }));
  const seen = new Set();
  for (let d = 0; d < 7; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins) seen.add(ins.kind);
  }
  assert.ok(seen.size >= 2, `expected at least 2 distinct insight kinds over a week, got ${[...seen]}`);
});

test("dailyInsight reports a weekly improvement with an 'up' tone", () => {
  const entries = [];
  for (let i = 0; i < 7; i++) entries.push(entry(i, { sleep_hours: 8, sleep_quality: 9, nutrition_quality: 9, exercise_minutes: 45, stress_level: 2 }));
  for (let i = 7; i < 14; i++) entries.push(entry(i, { sleep_hours: 5, sleep_quality: 4, nutrition_quality: 4, exercise_minutes: 0, stress_level: 8 }));
  // Force the weekly kind by scanning a week of dates until it comes up.
  let found = null;
  for (let d = 0; d < 7 && !found; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins && ins.kind === "weekly_delta") found = ins;
  }
  assert.ok(found, "weekly_delta insight never surfaced");
  assert.equal(found.tone, "up");
  assert.match(found.text, /semana/);
});

test("dailyInsight surfaces the sleep-stress link when the data shows one", () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push(entry(i, { sleep_hours: i % 2 ? 5.5 : 8, stress_level: i % 2 ? 8 : 2 }));
  let found = null;
  for (let d = 0; d < 10 && !found; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    if (ins && ins.kind === "sleep_stress_link") found = ins;
  }
  assert.ok(found, "sleep_stress_link never surfaced");
  assert.match(found.text, /dorm/);
});

test("dailyInsight never shows a weekly comparison with fewer than 2 weeks of data", () => {
  const entries = [entry(0), entry(1), entry(2)];
  for (let d = 0; d < 14; d++) {
    const ins = dailyInsight(entries, DEFAULT_GOALS, isoDaysAgo(-d));
    assert.notEqual(ins && ins.kind, "weekly_delta");
  }
});
