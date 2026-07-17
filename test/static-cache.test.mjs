import { test } from "node:test";
import assert from "node:assert/strict";
import { loadStaticCache } from "./lib/load-static-cache.js";

const { cachedFetchJSON } = loadStaticCache();

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = v;
    },
    _store: store,
  };
}

test("cachedFetchJSON fetches over the network and populates the cache on a cold cache", async () => {
  const storage = makeStorage();
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => [{ id: 1, name: "item1" }] };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 1000, storage, fetcher);

  assert.deepEqual(data, [{ id: 1, name: "item1" }]);
  assert.equal(fetchCalls, 1);
  const stored = JSON.parse(storage._store["k"]);
  assert.deepEqual(stored.data, [{ id: 1, name: "item1" }]);
  assert.equal(typeof stored.ts, "number");
});

test("cachedFetchJSON serves from cache within the TTL without calling fetch", async () => {
  const cached = JSON.stringify({ data: [{ id: 2, name: "cached" }], ts: Date.now() });
  const storage = makeStorage({ k: cached });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => [{ id: 2, name: "network" }] };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 60000, storage, fetcher);

  assert.deepEqual(data, [{ id: 2, name: "cached" }]);
  assert.equal(fetchCalls, 0);
});

test("cachedFetchJSON refetches once the TTL has expired", async () => {
  const staleTs = Date.now() - 10000;
  const cached = JSON.stringify({ data: [{ id: 3, name: "stale" }], ts: staleTs });
  const storage = makeStorage({ k: cached });
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => [{ id: 3, name: "fresh" }] };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 1000, storage, fetcher);

  assert.deepEqual(data, [{ id: 3, name: "fresh" }]);
  assert.equal(fetchCalls, 1);
});

test("cachedFetchJSON falls back to a real fetch when the cached entry is corrupted JSON", async () => {
  const storage = makeStorage({ k: "not-json{{{"});
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => [{ id: 4, name: "recovered" }] };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 60000, storage, fetcher);

  assert.deepEqual(data, [{ id: 4, name: "recovered" }]);
  assert.equal(fetchCalls, 1);
});

test("cachedFetchJSON does not cache non-array error responses", async () => {
  const storage = makeStorage();
  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    return { json: async () => ({ message: "JWT expired" }) };
  };

  const data = await cachedFetchJSON("k", "http://x", {}, 60000, storage, fetcher);

  assert.deepEqual(data, { message: "JWT expired" });
  assert.equal(fetchCalls, 1);
  assert.equal(storage._store["k"], undefined, "error response should not be cached");
});
