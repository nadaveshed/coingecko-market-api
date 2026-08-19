# Market Overview API

A small service that pulls cryptocurrency market data from the public CoinGecko API, keeps only the fields worth keeping, and returns a single aggregated snapshot of the market: totals across the coins it scanned, how many are up or down over 24 hours, and the leaders by market cap, volume and price change.

It also serves a one-page UI, so you can try the endpoint without a REST client.

## Tech stack

Node.js 20.12+ with TypeScript, Fastify for the HTTP layer, Zod for query validation, and Node's built-in test runner. No test framework, no DI container, no ORM — nothing here needs them.

## Running it

```bash
npm install
npm run dev
```

The server listens on http://localhost:8000, and the UI is at the same address.

```bash
npm test    # 39 tests, no network needed
npm run check  # typecheck, lint, format check, tests, build
```

For a production build:

```bash
npm run build
npm start
```

Or with Docker:

```bash
docker build -t market-overview-api .
docker run --rm -p 8000:8000 --env-file .env market-overview-api
```

Copy `.env.example` to `.env` for the upstream URL and an optional API key. If you deploy behind a trusted reverse proxy, set `APP_TRUST_PROXY=true` so rate limiting uses the forwarded client address — leave it off when the app is directly exposed. Everything else (cache TTL, timeouts, concurrency, rate limits, aggregation thresholds) lives in `src/config/index.ts`.

## The endpoint

```
GET /api/market/overview?currency=usd&page=1&limit=200
```

| Param      | Default | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| `currency` | `usd`   | one of `usd`, `eur`, `gbp`, `ils`      |
| `page`     | `1`     | CoinGecko page to start from           |
| `limit`    | `100`   | how many coins to aggregate, up to 500 |

Page size upstream is 100, so `limit=125` fetches two pages and aggregates the first 125 valid coins.

```json
{
  "fetch": { "requested_pages": [1, 2], "fetched_pages": [1, 2], "failed_pages": [], "degraded": false },
  "universe": {
    "count": 125,
    "market_cap": 2262482723099,
    "volume_24h": 75222319949.68,
    "up": 72,
    "down": 25,
    "flat": 28,
    "unknown_change": 0,
    "market_cap_gte_1b": 66,
    "large_cap": 11,
    "mid_cap": 55,
    "small_cap": 59,
    "unknown_market_cap": 0
  },
  "top_market_cap": [],
  "top_volume": [],
  "top_gainers": [],
  "top_losers": [],
  "meta": { "cache": "miss", "coalesced": false, "source": "coingecko", "currency": "usd" }
}
```

Coin objects carry only `id`, `symbol`, `name`, `rank`, `price`, `market_cap`, `volume_24h` and `change_24h_pct`. `GET /health` and `GET /ready` are there for container probes.

## How it works

The request path is routes → controller → service → CoinGecko client, and that's the whole structure. I used Fastify rather than NestJS so that path stays readable without a DI container; the layers are the same either way.

The parsing is the easy part. The real constraint is that public CoinGecko allows only a handful of calls per minute, and most of the design follows from it:

- Pages are fetched in parallel, but a process-wide limiter keeps at most two calls in flight, so one request can't burn the quota.
- Results are cached for 30 seconds, and identical requests arriving while a fetch is still running wait on that fetch instead of starting their own.
- A failed page doesn't fail the request. Whatever came back is aggregated and returned with `degraded: true` and an `X-Degraded` header. Only when every page fails does the request give up: 504 if they all timed out, 502 otherwise.
- Each row is cut down to eight fields as soon as it arrives, so images, ATH history and sparklines never reach the aggregation step.
- Upstream 429s and 5xx are retried with backoff, honouring `Retry-After` up to a cap.

Aggregation is deterministic arithmetic: top 20 by market cap, top 10 by volume, and the top 10 genuine gainers and losers in each direction. Coins with no reported change or market cap are counted as `unknown_*` rather than being folded into "flat" or "small cap", which would quietly overstate both. An empty but valid upstream page is a legitimate empty result, not a failure.

Errors always come back in one shape — `{ error, detail, request_id }` — as `invalid_query` (400), `not_found` (404), `validation_error` (422), `rate_limited` (429), `bad_gateway` (502) or `gateway_timeout` (504). Every response carries an `X-Request-ID`.

## Trade-offs

The cache, the request coalescing and the rate limiter all live in process memory, so they only help a single instance. Redis would be the first thing to reach for if this ran on more than one box. There's no circuit breaker either, so during a long CoinGecko brownout every request still pays for its retries before failing.

I skipped per-coin category data. It's genuinely useful, but it costs one upstream call per coin, and the rate limit makes that unworkable without a much more serious caching story. Given more time I'd also add metrics, tracing and graceful shutdown — none of which earn their keep in a single-instance take-home.

## A note on AI

I used Cursor throughout, and roughly 40% of what's here came out of it: the Fastify and TypeScript scaffolding, most of the client and utility layer (retry, TTL cache, concurrency limiter), and a good share of the test bodies once I'd decided what was worth testing. The other 60% is mine — the architecture, the concurrency and caching strategy, the response shape, and the review pass that made the generated code actually correct.

That review pass earned its keep. Three things the first draft got wrong:

- **`limit` didn't limit.** It was treated as a page budget, so `limit=1` returned 100 coins and `limit=125` returned 200. The list is now sliced to the requested size, and `limit` is part of the cache key.
- **`gateway_timeout` was unreachable.** Every page error was swallowed into a generic 502, so the 504 branch existed in the code but could never fire. An all-timeout failure now propagates as 504.
- **Missing data was counted as real data.** Coins with no reported 24h change were counted as "flat", and coins with no market cap as "small cap" — on a live run that inflated `flat` to 41 of 200. Both are `unknown_*` counters now.

None of those would have surfaced from the tests as generated: the fixtures used exact page multiples and complete rows, so every bug was invisible until I ran it against the live API. That's the part worth knowing about AI-assisted code — it writes tests that agree with it.
