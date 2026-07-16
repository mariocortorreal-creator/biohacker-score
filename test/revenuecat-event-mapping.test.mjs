import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRevenueCatEvent } from "../supabase/functions/_shared/revenuecat-event-mapping.mjs";

test("INITIAL_PURCHASE grants premium with the matched tier and platform", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["pro"],
    store: "APP_STORE",
  });
  assert.deepEqual(result, {
    action: "grant",
    profileId: "user-123",
    patch: { premium_source: "paid", subscription_tier: "pro", payment_platform: "apple_iap" },
  });
});

test("RENEWAL, PRODUCT_CHANGE, and UNCANCELLATION all grant the same way", () => {
  for (const type of ["RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]) {
    const result = mapRevenueCatEvent({
      type,
      app_user_id: "user-123",
      entitlement_ids: ["elite"],
      store: "PLAY_STORE",
    });
    assert.equal(result.action, "grant", `expected grant for ${type}`);
    assert.equal(result.patch.subscription_tier, "elite");
    assert.equal(result.patch.payment_platform, "google_iap");
  }
});

test("EXPIRATION revokes premium", () => {
  const result = mapRevenueCatEvent({
    type: "EXPIRATION",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "APP_STORE",
  });
  assert.deepEqual(result, {
    action: "revoke",
    profileId: "user-123",
    patch: { premium_source: null },
  });
});

test("CANCELLATION alone does not revoke access (user keeps access until EXPIRATION)", () => {
  const result = mapRevenueCatEvent({
    type: "CANCELLATION",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("unknown event types are ignored", () => {
  const result = mapRevenueCatEvent({ type: "BILLING_ISSUE", app_user_id: "user-123" });
  assert.equal(result.action, "ignore");
});

test("a grant event with no known tier in entitlement_ids is ignored", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["some_other_entitlement"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("a grant event with no app_user_id is ignored", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: null,
    entitlement_ids: ["pro"],
    store: "APP_STORE",
  });
  assert.equal(result.action, "ignore");
});

test("an unrecognized store value still grants, with a null payment_platform", () => {
  const result = mapRevenueCatEvent({
    type: "INITIAL_PURCHASE",
    app_user_id: "user-123",
    entitlement_ids: ["basico"],
    store: "STRIPE",
  });
  assert.equal(result.action, "grant");
  assert.equal(result.patch.payment_platform, null);
});
