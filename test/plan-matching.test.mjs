import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapStripeStatusToCoachStatus,
  resolvePlanFromAmount,
} from "../supabase/functions/_shared/plan-matching.mjs";

const COACH_PRICE_CENTS = 2000;
const TIER_AMOUNTS_CENTS = { basico: 799, pro: 1400, elite: 1900 };

test("mapStripeStatusToCoachStatus maps active/trialing to active", () => {
  assert.equal(mapStripeStatusToCoachStatus("active"), "active");
  assert.equal(mapStripeStatusToCoachStatus("trialing"), "active");
});

test("mapStripeStatusToCoachStatus maps past_due as-is", () => {
  assert.equal(mapStripeStatusToCoachStatus("past_due"), "past_due");
});

test("mapStripeStatusToCoachStatus maps canceled/unpaid/incomplete_expired to canceled", () => {
  assert.equal(mapStripeStatusToCoachStatus("canceled"), "canceled");
  assert.equal(mapStripeStatusToCoachStatus("unpaid"), "canceled");
  assert.equal(mapStripeStatusToCoachStatus("incomplete_expired"), "canceled");
});

test("mapStripeStatusToCoachStatus returns null for a non-actionable status", () => {
  assert.equal(mapStripeStatusToCoachStatus("incomplete"), null);
});

test("resolvePlanFromAmount matches the coach price", () => {
  assert.deepEqual(
    resolvePlanFromAmount(COACH_PRICE_CENTS, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS),
    { type: "coach" }
  );
});

test("resolvePlanFromAmount matches each client tier by exact amount", () => {
  assert.deepEqual(
    resolvePlanFromAmount(799, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS),
    { type: "client", tier: "basico" }
  );
  assert.deepEqual(
    resolvePlanFromAmount(1400, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS),
    { type: "client", tier: "pro" }
  );
  assert.deepEqual(
    resolvePlanFromAmount(1900, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS),
    { type: "client", tier: "elite" }
  );
});

test("resolvePlanFromAmount returns null for an amount matching no known plan", () => {
  // Regression guard: an earlier version of stripe-webhook used placeholder amounts
  // (999/1399/1999) that never matched the real Payment Links, so a paying client would
  // have hit this branch and never received premium. This locks in that "no match" must
  // stay explicit (null), not silently fall through to some default plan.
  assert.equal(resolvePlanFromAmount(999, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS), null);
  assert.equal(resolvePlanFromAmount(0, COACH_PRICE_CENTS, TIER_AMOUNTS_CENTS), null);
});
