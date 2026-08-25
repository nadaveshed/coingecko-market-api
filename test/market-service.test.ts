import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config/index.js";
import {
  InvalidQueryError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
  TtlCache,
  BoundedLimiter,
  Singleflight,
} from "../src/utils/index.js";
import { MarketService } from "../src/services/index.js";
import { FakeUpstream } from "./fakes.js";
import { BTC, DOGE, ETH, TINY } from "./fixtures.js";
import { testConfig } from "./helpers.js";

function service(upstream: FakeUpstream, overrides = {}) {
  const config = loadConfig(testConfig(overrides));
  return new MarketService(
    upstream,
    new TtlCache(),
    config,
    new BoundedLimiter(config.outboundConcurrency),
    new Singleflight(),
  );
}

test("overview filters and aggregates", async () => {
  const result = await service(new FakeUpstream()).overview({ currency: "USD", page: 1, limit: 4 });
  assert.equal(result.universe.count, 4);
  assert.equal(result.top_market_cap[0]?.id, "bitcoin");
  assert.equal(result.meta.cache, "miss");
  assert.equal("image" in (result.top_market_cap[0] ?? {}), false);
});

test("overview respects an exact non-page-aligned limit", async () => {
  const upstream = new FakeUpstream();
  const result = await service(upstream).overview({ currency: "usd", page: 1, limit: 1 });
  assert.equal(result.universe.count, 1);
  assert.deepEqual(upstream.calls, [1]);
});

test("overview uses cache", async () => {
  const upstream = new FakeUpstream();
  const market = service(upstream);
  await market.overview({ currency: "usd", page: 1, limit: 4 });
  const second = await market.overview({ currency: "usd", page: 1, limit: 4 });
  assert.equal(second.meta.cache, "hit");
  assert.deepEqual(upstream.calls, [1, 2]);
});

test("bounded concurrency", async () => {
  const upstream = new FakeUpstream({ 1: [BTC], 2: [ETH], 3: [DOGE], 4: [TINY] });
  upstream.delayMs = 50;
  await service(upstream, { defaultPageSize: 1, outboundConcurrency: 2 }).overview({
    currency: "usd",
    page: 1,
    limit: 4,
  });
  assert.ok(upstream.maxInflight <= 2);
  assert.deepEqual(
    [...upstream.calls].sort((a, b) => a - b),
    [1, 2, 3, 4],
  );
});

test("partial page failure is degraded not fatal", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[2] = new UpstreamTimeoutError("page 2 timed out");
  const result = await service(upstream).overview({ currency: "usd", page: 1, limit: 4 });
  assert.equal(result.fetch.degraded, true);
  assert.ok(result.fetch.failed_pages.includes(2));
  assert.equal(result.universe.count, 2);
});

test("all pages fail", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[1] = new UpstreamUnavailableError("down");
  upstream.errors[2] = new UpstreamUnavailableError("down");
  await assert.rejects(
    () => service(upstream).overview({ currency: "usd", page: 1, limit: 4 }),
    UpstreamUnavailableError,
  );
});

test("valid empty pages return an empty overview", async () => {
  const result = await service(new FakeUpstream({ 20: [] })).overview({ currency: "usd", page: 20, limit: 1 });
  assert.equal(result.universe.count, 0);
  assert.deepEqual(result.fetch.fetched_pages, [20]);
  assert.equal(result.fetch.degraded, false);
});

test("unexpected implementation errors are not downgraded to partial failures", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[1] = new TypeError("programming error");
  await assert.rejects(() => service(upstream).overview({ currency: "usd", page: 1, limit: 1 }), TypeError);
});

test("coalesces duplicate in-flight requests", async () => {
  const upstream = new FakeUpstream();
  upstream.delayMs = 50;
  const market = service(upstream);
  await Promise.all([
    market.overview({ currency: "usd", page: 1, limit: 4 }),
    market.overview({ currency: "usd", page: 1, limit: 4 }),
  ]);
  assert.deepEqual(upstream.calls, [1, 2]);
});

test("rejects bad currency", async () => {
  await assert.rejects(
    () => service(new FakeUpstream()).overview({ currency: "xyz", page: 1, limit: 4 }),
    InvalidQueryError,
  );
});

test("perPage overrides the configured page size", async () => {
  const upstream = new FakeUpstream();
  const result = await service(upstream).overview({ currency: "usd", page: 1, limit: 4, perPage: 4 });
  assert.deepEqual(upstream.calls, [1]);
  assert.equal(result.fetch.per_page, 4);
});
