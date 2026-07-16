import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyStripeSignature } from "../supabase/functions/_shared/stripe-signature.mjs";

const SECRET = "whsec_test_secret";

async function signPayload(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

test("verifyStripeSignature accepts a correctly signed payload", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = "1700000000";
  const signature = await signPayload(rawBody, SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), true);
});

test("verifyStripeSignature rejects a payload signed with a different secret", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = "1700000000";
  const signature = await signPayload(rawBody, "whsec_wrong_secret", timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), false);
});

test("verifyStripeSignature rejects a tampered body", async () => {
  const timestamp = "1700000000";
  const signature = await signPayload(JSON.stringify({ amount: 100 }), SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(
    await verifyStripeSignature(JSON.stringify({ amount: 999999 }), header, SECRET),
    false
  );
});

test("verifyStripeSignature rejects a missing or malformed header", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  assert.equal(await verifyStripeSignature(rawBody, "", SECRET), false);
  assert.equal(await verifyStripeSignature(rawBody, "garbage-header", SECRET), false);
  assert.equal(await verifyStripeSignature(rawBody, "t=1700000000", SECRET), false);
});
