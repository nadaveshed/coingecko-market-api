# coingecko-market-api

A lightweight TypeScript/Fastify service that fetches public CoinGecko market data, keeps eight useful fields, and returns market totals, cap buckets, and leaders by market cap, volume, gain, and loss. A small UI is available at the root URL.

## Run

Requires Node.js 20.12+.

```bash
npm install
npm run dev
```

Open http://localhost:8000. To verify the project:

```bash
npm run check # typecheck, lint, format, 40 tests, and build
```

Production and Docker:

```bash
npm run build && npm start
docker build -t coingecko-market-api .
docker run --rm -p 8000:8000 --env-file .env coingecko-market-api
```

`.env` is optional; see `.env.example` for the upstream URL, API key, and trusted-proxy setting.

## API

```http
GET /api/market/overview?currency=usd&page=1&limit=200
```

| Parameter  | Default | Valid values               |
| ---------- | ------- | -------------------------- |
| `currency` | `usd`   | `usd`, `eur`, `gbp`, `ils` |
| `page`     | `1`     | CoinGecko starting page    |
| `limit`    | `100`   | 1–500 coins                |

The response contains `fetch`, `universe`, `top_market_cap`, `top_volume`, `top_gainers`, `top_losers`, and `meta`. Coin objects contain only `id`, `symbol`, `name`, `rank`, `price`, `market_cap`, `volume_24h`, and `change_24h_pct`.

Errors always use `{ error, detail, request_id }`. Relevant statuses are 400, 404, 422, 429, 502, and 504. Health probes are available at `/health` and `/ready`.

## Architecture

The request flow is route → controller → service → CoinGecko client. Pages are fetched with bounded concurrency, retry transient upstream failures, and honor capped `Retry-After` values. Results use a 30-second in-memory cache and singleflight request coalescing.

Partial page failures return available data with `fetch.degraded=true` and `X-Degraded: true`. If every page fails, the API returns 504 for all-timeout failures and 502 otherwise. Valid empty pages return an empty 200 response. Missing market-cap and change values are counted as unknown instead of small-cap or flat.

## Trade-offs

Cache, rate limiting, and request coalescing are process-local. A multi-instance deployment should move them to Redis. With more time I would add a circuit breaker, metrics, tracing, graceful shutdown, and a multi-stage Docker build.

## AI disclosure

Cursor assisted with scaffolding, utilities, and test generation. I defined the architecture and response contract, then reviewed and corrected generated behavior around exact limits, timeout propagation, mover filtering, and missing upstream values.
