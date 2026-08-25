import assert from "node:assert/strict";
import { test } from "node:test";

import { InvalidUpstreamPayloadError, buildOverview, pagePlan, parseCoin, parsePage } from "../src/utils/index.js";
import { defaults } from "../src/config/index.js";
import { BTC, ETH, MALFORMED, TINY } from "./fixtures.js";

test("parseCoin drops unused fields", () => {
  const coin = parseCoin(BTC);
  assert.ok(coin);
  assert.equal(coin.id, "bitcoin");
  assert.equal(coin.symbol, "btc");
  assert.equal(coin.market_cap, 1_200_000_000_000.0);
  assert.equal("image" in coin, false);
  assert.equal("ath" in coin, false);
});

test("parseCoin rejects unusable rows", () => {
  assert.equal(parseCoin(null), null);
  assert.equal(parseCoin(MALFORMED), null);
  assert.equal(parseCoin({ id: "x", symbol: 1, name: "X" }), null);
});

test("parsePage skips bad rows", () => {
  const coins = parsePage([MALFORMED, ETH]);
  assert.equal(coins.length, 1);
  assert.equal(coins[0]?.id, "ethereum");
});

test("parsePage rejects a non-list payload", () => {
  assert.throws(() => parsePage({ data: [] }), InvalidUpstreamPayloadError);
});

test("pagePlan covers limit with a cap", () => {
  assert.deepEqual(pagePlan(1, 100, 100, 5), [1]);
  assert.deepEqual(pagePlan(1, 250, 100, 5), [1, 2, 3]);
  assert.deepEqual(pagePlan(2, 500, 100, 5), [2, 3, 4, 5, 6]);
});

test("aggregation counts and rankings", () => {
  const coins = parsePage([BTC, ETH, TINY]);
  const overview = buildOverview(
    coins,
    {
      requestedPages: [1],
      perPage: 100,
      fetchedPages: [1],
      failedPages: [],
      currency: "usd",
      cache: "miss",
      coalesced: false,
    },
    defaults,
  );
  assert.equal(overview.universe.count, 3);
  assert.equal(overview.universe.up, 1);
  assert.equal(overview.universe.down, 1);
  assert.equal(overview.universe.flat, 1);
  assert.equal(overview.universe.market_cap_gte_1b, 2);
  assert.equal(overview.top_market_cap[0]?.id, "bitcoin");
  assert.equal(overview.top_gainers[0]?.id, "bitcoin");
  assert.equal(overview.top_losers[0]?.id, "ethereum");
  assert.ok(overview.top_gainers.every((coin) => (coin.change_24h_pct ?? 0) > 0));
  assert.ok(overview.top_losers.every((coin) => (coin.change_24h_pct ?? 0) < 0));
  assert.equal(overview.fetch.degraded, false);
});

test("aggregation reports missing metrics separately", () => {
  const unknown = parseCoin({
    id: "unknown",
    symbol: "unk",
    name: "Unknown",
    market_cap: null,
    price_change_percentage_24h: null,
  });
  assert.ok(unknown);
  const overview = buildOverview(
    [unknown],
    {
      requestedPages: [1],
      perPage: 100,
      fetchedPages: [1],
      failedPages: [],
      currency: "usd",
      cache: "miss",
      coalesced: false,
    },
    defaults,
  );
  assert.equal(overview.universe.flat, 0);
  assert.equal(overview.universe.small_cap, 0);
  assert.equal(overview.universe.unknown_change, 1);
  assert.equal(overview.universe.unknown_market_cap, 1);
});
