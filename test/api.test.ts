import assert from "node:assert/strict";
import { test } from "node:test";

import { UpstreamTimeoutError, UpstreamUnavailableError } from "../src/utils/index.js";
import { FakeUpstream } from "./fakes.js";
import { buildApp } from "./helpers.js";

test("health and ready", async () => {
  const app = await buildApp();
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    assert.deepEqual(health.json(), { status: "ok" });
    assert.equal(ready.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("ui index", async () => {
  const app = await buildApp();
  try {
    const page = await app.inject({ method: "GET", url: "/" });
    const css = await app.inject({ method: "GET", url: "/static/styles.css" });
    assert.equal(page.statusCode, 200);
    assert.match(String(page.headers["content-type"]), /text\/html/);
    assert.equal(css.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("unknown routes use the API error contract", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/nope" });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: "not_found",
      detail: "Route not found.",
      request_id: response.headers["x-request-id"],
    });
  } finally {
    await app.close();
  }
});

test("overview filters and aggregates", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    const body = response.json();
    assert.equal(response.statusCode, 200);
    assert.equal(body.top_market_cap[0].id, "bitcoin");
    assert.equal("image" in body.top_market_cap[0], false);
    assert.equal(body.universe.count, 4);
    assert.equal(body.meta.source, "coingecko");
  } finally {
    await app.close();
  }
});

test("overview cache hit", async () => {
  const upstream = new FakeUpstream();
  const app = await buildApp({ upstream });
  try {
    const first = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    const second = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    assert.equal(first.headers["x-cache"], "miss");
    assert.equal(second.headers["x-cache"], "hit");
    assert.deepEqual(upstream.calls, [1, 2]);
  } finally {
    await app.close();
  }
});

test("overview partial failure", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[2] = new UpstreamTimeoutError("page failed");
  const app = await buildApp({ upstream });
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-degraded"], "true");
    assert.equal(response.json().fetch.degraded, true);
  } finally {
    await app.close();
  }
});

test("overview all pages fail", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[1] = new UpstreamUnavailableError("down");
  upstream.errors[2] = new UpstreamUnavailableError("down");
  const app = await buildApp({ upstream });
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    assert.equal(response.statusCode, 502);
  } finally {
    await app.close();
  }
});

test("overview returns 504 when every page times out", async () => {
  const upstream = new FakeUpstream();
  upstream.errors[1] = new UpstreamTimeoutError("timed out");
  upstream.errors[2] = new UpstreamTimeoutError("timed out");
  const app = await buildApp({ upstream });
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    assert.equal(response.statusCode, 504);
    assert.equal(response.json().error, "gateway_timeout");
  } finally {
    await app.close();
  }
});

test("overview returns 200 for valid empty pages", async () => {
  const app = await buildApp({ upstream: new FakeUpstream({ 20: [] }) });
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=20&limit=1" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().universe.count, 0);
  } finally {
    await app.close();
  }
});

test("overview rejects bad currency", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=yen" });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_query");
  } finally {
    await app.close();
  }
});

test("overview rejects short currency", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=us" });
    assert.equal(response.statusCode, 422);
  } finally {
    await app.close();
  }
});

test("per_page controls how many upstream pages are fetched", async () => {
  const upstream = new FakeUpstream();
  const app = await buildApp({ upstream });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/market/overview?currency=usd&page=1&per_page=4&limit=4",
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(upstream.calls, [1]);
    assert.equal(response.json().fetch.per_page, 4);
  } finally {
    await app.close();
  }
});

test("per_page falls back to the configured page size", async () => {
  const upstream = new FakeUpstream();
  const app = await buildApp({ upstream });
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?currency=usd&page=1&limit=4" });
    assert.deepEqual(upstream.calls, [1, 2]);
    assert.equal(response.json().fetch.per_page, 2);
  } finally {
    await app.close();
  }
});

test("per_page is part of the cache key", async () => {
  const app = await buildApp({ upstream: new FakeUpstream() });
  try {
    const first = await app.inject({
      method: "GET",
      url: "/api/market/overview?currency=usd&page=1&per_page=2&limit=4",
    });
    const second = await app.inject({
      method: "GET",
      url: "/api/market/overview?currency=usd&page=1&per_page=4&limit=4",
    });
    assert.equal(first.headers["x-cache"], "miss");
    assert.equal(second.headers["x-cache"], "miss");
  } finally {
    await app.close();
  }
});

test("per_page above the cap is rejected", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/market/overview?per_page=999" });
    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
