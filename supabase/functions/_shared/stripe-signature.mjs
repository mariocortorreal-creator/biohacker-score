// Verifies a Stripe webhook signature (Stripe-Signature header format: "t=...,v1=...").
// Pure aside from Web Crypto (crypto.subtle), which is a global in both Deno and Node
// (20+) — no runtime-specific import needed, so this same file is importable from the
// Deno edge function (supabase/functions/stripe-webhook/index.ts) and from Node tests.
export async function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("="))
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // timing-safe-ish compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
