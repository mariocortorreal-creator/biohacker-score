const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadScoringEngine } = require("./lib/load-scoring-engine");

const {
  sleepScore,
  nutritionScore,
  exerciseScore,
  stressScore,
  totalScore,
  scoreColor,
  computeStreak,
  weeklyComparison,
  DEFAULT_GOALS,
} = loadScoringEngine();

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test("sleepScore returns null when an input is missing", () => {
  assert.equal(sleepScore(null, 8, 8), null);
  assert.equal(sleepScore(8, null, 8), null);
});

test("sleepScore is 100 at goal with perfect quality", () => {
  assert.equal(sleepScore(8, 10, 8), 100);
});

test("sleepScore penalizes distance from goal", () => {
  assert.equal(sleepScore(5, 10, 8), 50);
  assert.equal(sleepScore(6.5, 10, 8), 80);
});

test("nutritionScore returns null when an input is missing", () => {
  assert.equal(nutritionScore(null, 8, 16), null);
  assert.equal(nutritionScore(16, null, 16), null);
});

test("nutritionScore floors the fasting component beyond the tolerance window", () => {
  assert.equal(nutritionScore(16, 10, 16), 100);
  assert.equal(nutritionScore(8, 10, 16), 60);
});

test("exerciseScore returns null when minutes/intensity missing", () => {
  assert.equal(exerciseScore(null, 5, 45), null);
});

test("exerciseScore scales with minutes and caps at 100", () => {
  assert.equal(exerciseScore(0, 5, 45), 20);
  assert.equal(exerciseScore(45, 5, 45), 80);
  assert.equal(exerciseScore(90, 10, 45), 100);
});

test("stressScore returns null when stress level missing", () => {
  assert.equal(stressScore(null, 3), null);
});

test("stressScore is 100 at or under the goal max", () => {
  assert.equal(stressScore(2, 3), 100);
  assert.equal(stressScore(3, 3), 100);
});

test("stressScore penalizes exceeding the goal max", () => {
  assert.equal(stressScore(10, 3), 0);
  assert.equal(stressScore(6, 2), 50);
});

test("totalScore averages only the non-null categories", () => {
  assert.equal(totalScore({ sleep: 100, nutrition: 100, exercise: 100, stress: 100 }), 100);
  assert.equal(totalScore({ sleep: 80, nutrition: null, exercise: 60, stress: null }), 70);
  assert.equal(totalScore({ sleep: null, nutrition: null, exercise: null, stress: null }), null);
});

test("scoreColor maps score bands to the expected accent colors", () => {
  assert.equal(scoreColor(null), "#3A4250");
  assert.equal(scoreColor(80), "#3DDCFF");
  assert.equal(scoreColor(79.9), "#7FE3A3");
  assert.equal(scoreColor(65), "#7FE3A3");
  assert.equal(scoreColor(45), "#FFC857");
  assert.equal(scoreColor(10), "#FF6B5E");
});

test("computeStreak is 0 for no entries", () => {
  assert.equal(computeStreak([]), 0);
});

test("computeStreak counts consecutive days ending today", () => {
  const entries = [0, 1, 2].map((n) => ({ entry_date: isoDaysAgo(n) }));
  assert.equal(computeStreak(entries), 3);
});

test("computeStreak still counts a streak that ends yesterday (today not logged yet)", () => {
  const entries = [1, 2].map((n) => ({ entry_date: isoDaysAgo(n) }));
  assert.equal(computeStreak(entries), 2);
});

test("computeStreak breaks on a gap", () => {
  const entries = [{ entry_date: isoDaysAgo(2) }]; // today and yesterday both missing
  assert.equal(computeStreak(entries), 0);
});

function perfectEntry(daysAgo) {
  return {
    entry_date: isoDaysAgo(daysAgo),
    sleep_hours: 8,
    sleep_quality: 10,
    fasting_hours: 16,
    nutrition_quality: 10,
    exercise_minutes: 45,
    exercise_intensity: 10,
    stress_level: 2,
  };
}
function poorEntry(daysAgo) {
  return {
    entry_date: isoDaysAgo(daysAgo),
    sleep_hours: 4,
    sleep_quality: 1,
    fasting_hours: 4,
    nutrition_quality: 1,
    exercise_minutes: 0,
    exercise_intensity: 1,
    stress_level: 9,
  };
}

test("weeklyComparison returns null with no entries", () => {
  assert.equal(weeklyComparison([], DEFAULT_GOALS), null);
});

test("weeklyComparison reports improvement when this week outscores last week", () => {
  const entries = [
    ...[0, 1, 2, 3, 4, 5, 6].map(perfectEntry),
    ...[7, 8, 9, 10, 11, 12, 13].map(poorEntry),
  ];
  const result = weeklyComparison(entries, DEFAULT_GOALS);
  assert.equal(result.thisAvg, 100);
  assert.ok(result.lastAvg < 100, `expected lastAvg < 100, got ${result.lastAvg}`);
  assert.ok(result.deltaPct > 0, `expected a positive deltaPct, got ${result.deltaPct}`);
});
