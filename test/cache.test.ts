import assert from "node:assert/strict";
import { test } from "node:test";

import { TtlCache } from "../src/utils/index.js";

test("cache returns value before ttl", () => {
  const cache = new TtlCache<string>();
  cache.set("k", "v", 30);
  assert.equal(cache.get("k"), "v");
});

test("cache expires", async () => {
  const cache = new TtlCache<string>();
  cache.set("k", "v", 0.01);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get("k"), undefined);
});

test("cache evicts oldest when full", () => {
  const cache = new TtlCache<number>(2);
  cache.set("a", 1, 30);
  cache.set("b", 2, 30);
  cache.set("c", 3, 30);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
});
