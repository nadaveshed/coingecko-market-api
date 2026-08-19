import assert from "node:assert/strict";
import { test } from "node:test";

import { RateLimiter } from "../src/utils/index.js";
import { FakeUpstream } from "./fakes.js";
import { buildApp } from "./helpers.js";

test("rate limiter blocks after max requests", () => {
  const limiter = new RateLimiter(2, 60);
  assert.equal(limiter.check("ip").allowed, true);
  assert.equal(limiter.check("ip").allowed, true);
  const limited = limiter.check("ip");
  assert.equal(limited.allowed, false);
  assert.ok(limited.retryAfter >= 1);
});

test("rate limiter isolates clients", () => {
  const limiter = new RateLimiter(1, 60);
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("b").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
});

test("rate limiter periodically removes expired client keys", () => {
  let now = 0;
  const limiter = new RateLimiter(2, 1, () => now);
  for (let index = 0; index < 99; index += 1) limiter.check(`client-${index}`);
  assert.equal(limiter.trackedClients, 99);
  now = 2_000;
  limiter.check("current-client");
  assert.equal(limiter.trackedClients, 1);
});

test("api returns 429 when limit exceeded", async () => {
  const app = await buildApp({
    config: { rateLimitMaxRequests: 2, rateLimitWindowSeconds: 60 },
    upstream: new FakeUpstream(),
  });
  try {
    const first = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    const second = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    const limited = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.json().error, "rate_limited");
    assert.ok(limited.headers["retry-after"]);
    assert.equal(health.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("trusted proxy mode rate-limits forwarded client IPs independently", async () => {
  const app = await buildApp({
    config: { rateLimitMaxRequests: 1, rateLimitWindowSeconds: 60, trustProxy: true },
    upstream: new FakeUpstream(),
  });
  try {
    const firstA = await app.inject({
      method: "GET",
      url: "/api/market/overview?limit=1",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    const secondA = await app.inject({
      method: "GET",
      url: "/api/market/overview?limit=1",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    const firstB = await app.inject({
      method: "GET",
      url: "/api/market/overview?limit=1",
      headers: { "x-forwarded-for": "198.51.100.2" },
    });
    assert.equal(firstA.statusCode, 200);
    assert.equal(secondA.statusCode, 429);
    assert.equal(firstB.statusCode, 200);
  } finally {
    await app.close();
  }
});
