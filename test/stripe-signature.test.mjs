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

test("verifyStripeSignature accepts a correctly signed payload with a fresh timestamp", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(rawBody, SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), true);
});

test("verifyStripeSignature rejects a payload signed with a different secret", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(rawBody, "whsec_wrong_secret", timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), false);
});

test("verifyStripeSignature rejects a tampered body", async () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signPayload(JSON.stringify({ amount: 100 }), SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(
    await verifyStripeSignature(JSON.stringify({ amount: 999999 }), header, SECRET),
    false
  );
});

test("verifyStripeSignature rejects a missing or malformed header", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const fresh = String(Math.floor(Date.now() / 1000));
  assert.equal(await verifyStripeSignature(rawBody, "", SECRET), false);
  assert.equal(await verifyStripeSignature(rawBody, "garbage-header", SECRET), false);
  assert.equal(await verifyStripeSignature(rawBody, `t=${fresh}`, SECRET), false);
});

test("verifyStripeSignature rejects a validly-signed but stale timestamp (replay protection)", async () => {
  // A real, correctly-signed payload from 10 minutes ago — simulates an attacker
  // replaying a captured (rawBody, signature) pair well past Stripe's 5-minute window.
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);
  const signature = await signPayload(rawBody, SECRET, staleTimestamp);
  const header = `t=${staleTimestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), false);
});

test("verifyStripeSignature accepts a timestamp just inside the tolerance window", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = String(Math.floor(Date.now() / 1000) - 290);
  const signature = await signPayload(rawBody, SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET), true);
});

test("verifyStripeSignature respects a custom toleranceSeconds override", async () => {
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const timestamp = String(Math.floor(Date.now() / 1000) - 30);
  const signature = await signPayload(rawBody, SECRET, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(rawBody, header, SECRET, 10), false);
});
