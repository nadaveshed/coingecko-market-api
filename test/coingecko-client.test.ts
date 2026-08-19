import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config/index.js";
import { UpstreamUnavailableError } from "../src/utils/index.js";
import { CoinGeckoClient } from "../src/services/index.js";
import { BTC } from "./fixtures.js";

function client(fetchFn: typeof fetch, overrides = {}) {
  return new CoinGeckoClient(
    loadConfig({
      maxAttempts: 2,
      retryBackoffSeconds: 0,
      maxRetryAfterSeconds: 0,
      requestTimeoutSeconds: 1,
      ...overrides,
    }),
    fetchFn,
  );
}

function queuedFetch(
  responses: Array<{ status: number; body?: unknown; headers?: Record<string, string>; text?: string }>,
): typeof fetch {
  let index = 0;
  return (async () => {
    const next = responses[index] ?? responses.at(-1);
    index += 1;
    if (!next) throw new Error("unexpected fetch");
    const body = next.text ?? JSON.stringify(next.body ?? {});
    return new Response(body, {
      status: next.status,
      headers: { "Content-Type": "application/json", ...next.headers },
    });
  }) as typeof fetch;
}

test("retries on 429 with Retry-After", async () => {
  const fetchFn = queuedFetch([
    { status: 429, text: "slow down", headers: { "Retry-After": "1" } },
    { status: 200, body: [BTC] },
  ]);
  const payload = (await client(fetchFn).markets({ vsCurrency: "usd", page: 1, perPage: 1 })) as Array<{ id: string }>;
  assert.equal(payload[0]?.id, "bitcoin");
});

test("does not retry non-retryable 4xx", async () => {
  const fetchFn = queuedFetch([{ status: 401, text: "nope" }]);
  await assert.rejects(
    () => client(fetchFn, { maxAttempts: 1 }).markets({ vsCurrency: "usd", page: 1, perPage: 1 }),
    UpstreamUnavailableError,
  );
});
