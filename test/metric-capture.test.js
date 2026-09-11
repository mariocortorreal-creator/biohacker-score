const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadMetricCapture } = require("./lib/load-metric-capture");

const {
  clockToMinutes,
  clockFromDb,
  hoursBetweenClock,
  sleepHoursFromClock,
  fastingHoursFromClock,
  nutritionQualityFromChecklist,
  NUTRITION_CHECKLIST,
  SLEEP_QUALITY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} = loadMetricCapture();

// ---------- clockToMinutes ----------

test("clockToMinutes converts a HH:MM string to minutes since midnight", () => {
  assert.equal(clockToMinutes("00:00"), 0);
  assert.equal(clockToMinutes("07:30"), 450);
  assert.equal(clockToMinutes("23:59"), 1439);
});

test("clockToMinutes returns null for missing or malformed input", () => {
  assert.equal(clockToMinutes(null), null);
  assert.equal(clockToMinutes(""), null);
  assert.equal(clockToMinutes("7:30 pm"), null);
  assert.equal(clockToMinutes("25:00"), null);
  assert.equal(clockToMinutes("12:75"), null);
});

// ---------- clockFromDb ----------

test("clockFromDb trims a Postgres time value down to what an <input type=time> accepts", () => {
  assert.equal(clockFromDb("07:00:00"), "07:00");
  assert.equal(clockFromDb("23:30:00"), "23:30");
});

test("clockFromDb passes through a value that is already HH:MM", () => {
  assert.equal(clockFromDb("07:00"), "07:00");
});

test("clockFromDb turns a missing value into an empty string, not the text 'null'", () => {
  // It feeds a controlled input directly; null would make React drop to uncontrolled.
  assert.equal(clockFromDb(null), "");
  assert.equal(clockFromDb(undefined), "");
});

// ---------- hoursBetweenClock ----------

test("hoursBetweenClock measures a span inside the same day", () => {
  assert.equal(hoursBetweenClock("13:00", "17:30"), 4.5);
});

test("hoursBetweenClock crosses midnight instead of going negative", () => {
  // Went to bed at 23:30, woke at 07:00 — 7.5 hours, not -16.5.
  assert.equal(hoursBetweenClock("23:30", "07:00"), 7.5);
  assert.equal(hoursBetweenClock("22:00", "06:30"), 8.5);
});

test("hoursBetweenClock treats identical times as zero, not a full day", () => {
  // A user who taps the same time twice has entered nothing useful; 24h would
  // silently score as a perfect night.
  assert.equal(hoursBetweenClock("07:00", "07:00"), 0);
});

test("hoursBetweenClock returns null when either end is missing", () => {
  assert.equal(hoursBetweenClock(null, "07:00"), null);
  assert.equal(hoursBetweenClock("23:00", null), null);
});

test("hoursBetweenClock rounds to a sane precision", () => {
  // 23:47 -> 06:52 is 7h05m = 7.0833...; the app stores half-hour-ish precision.
  assert.equal(hoursBetweenClock("23:47", "06:52"), 7.08);
});

// ---------- sleepHoursFromClock ----------

test("sleepHoursFromClock derives hours slept from bedtime and wake time", () => {
  assert.equal(sleepHoursFromClock("23:00", "07:00"), 8);
});

test("sleepHoursFromClock rejects an implausible span", () => {
  // Nobody sleeps 20 hours; that's a mis-entered AM/PM, and it must not
  // reach the scoring engine as a real value.
  assert.equal(sleepHoursFromClock("10:00", "06:00"), null);
});

// ---------- fastingHoursFromClock ----------

test("fastingHoursFromClock measures last meal yesterday to first meal today", () => {
  assert.equal(fastingHoursFromClock("20:00", "12:00"), 16);
});

test("fastingHoursFromClock handles a late-night last meal", () => {
  assert.equal(fastingHoursFromClock("23:00", "11:30"), 12.5);
});

test("fastingHoursFromClock returns null when either end is missing", () => {
  assert.equal(fastingHoursFromClock(null, "12:00"), null);
});

// ---------- nutritionQualityFromChecklist ----------

test("nutritionQualityFromChecklist scores a perfect day at 10", () => {
  const score = nutritionQualityFromChecklist({
    protein: true,
    vegetables: true,
    ultraprocessed: false,
    sugaryDrinks: false,
    alcohol: false,
  });
  assert.equal(score, 10);
});

test("nutritionQualityFromChecklist floors the worst possible day at 1", () => {
  const score = nutritionQualityFromChecklist({
    protein: false,
    vegetables: false,
    ultraprocessed: true,
    sugaryDrinks: true,
    alcohol: true,
  });
  assert.equal(score, 1);
});

test("nutritionQualityFromChecklist penalizes each miss by the same amount", () => {
  const perfect = nutritionQualityFromChecklist({
    protein: true, vegetables: true, ultraprocessed: false, sugaryDrinks: false, alcohol: false,
  });
  const oneMiss = nutritionQualityFromChecklist({
    protein: true, vegetables: false, ultraprocessed: false, sugaryDrinks: false, alcohol: false,
  });
  const twoMisses = nutritionQualityFromChecklist({
    protein: true, vegetables: false, ultraprocessed: true, sugaryDrinks: false, alcohol: false,
  });
  assert.equal(perfect - oneMiss, 2);
  assert.equal(oneMiss - twoMisses, 2);
});

test("nutritionQualityFromChecklist treats an untouched checklist as a neutral day", () => {
  // Opening the form and saving without ticking anything must not read as a
  // flawless day — the two positives are simply unconfirmed.
  assert.equal(nutritionQualityFromChecklist({}), 6);
});

test("nutritionQualityFromChecklist returns null when given nothing", () => {
  assert.equal(nutritionQualityFromChecklist(null), null);
});

// ---------- option tables ----------

test("NUTRITION_CHECKLIST describes every item the score reads", () => {
  const keys = NUTRITION_CHECKLIST.map((item) => item.key);
  assert.deepEqual(
    [...keys].sort(),
    ["alcohol", "protein", "sugaryDrinks", "ultraprocessed", "vegetables"]
  );
  for (const item of NUTRITION_CHECKLIST) {
    assert.ok(item.label.length > 0, `${item.key} needs a Spanish label`);
    assert.ok(
      item.good === true || item.good === false,
      `${item.key} must declare whether ticking it is good or bad`
    );
  }
});

test("descriptive option tables map plain-language answers onto the 1-10 scale", () => {
  for (const [name, options] of [
    ["SLEEP_QUALITY_OPTIONS", SLEEP_QUALITY_OPTIONS],
    ["EXERCISE_INTENSITY_OPTIONS", EXERCISE_INTENSITY_OPTIONS],
    ["STRESS_LEVEL_OPTIONS", STRESS_LEVEL_OPTIONS],
  ]) {
    assert.ok(options.length >= 3, `${name} needs at least 3 choices`);
    for (const opt of options) {
      assert.ok(opt.label.length > 0, `${name}: every choice needs a Spanish label`);
      assert.ok(
        Number.isInteger(opt.value) && opt.value >= 1 && opt.value <= 10,
        `${name}: "${opt.label}" must map to an integer 1-10, got ${opt.value}`
      );
    }
    // Compared element by element on purpose: these arrays are built inside the VM
    // sandbox, so deepStrictEqual against a locally-built array fails on prototypes
    // from a different realm rather than on the ordering we actually care about.
    const values = options.map((o) => o.value);
    for (let i = 1; i < values.length; i++) {
      assert.ok(
        values[i] > values[i - 1],
        `${name} must run from lowest to highest, got ${values[i - 1]} before ${values[i]}`
      );
    }
  }
});
