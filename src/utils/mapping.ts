import type { Config, Coin, CoinGeckoMarketRow, OverviewResponse } from "../types/index.js";
import { InvalidUpstreamPayloadError } from "./errors.js";

export function parseCoin(raw: unknown): Coin | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as CoinGeckoMarketRow;
  const id = row.id;
  const symbol = row.symbol;
  const name = row.name;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  if (typeof symbol !== "string" || typeof name !== "string") {
    return null;
  }
  const rank = row.market_cap_rank;
  return {
    id,
    symbol: symbol.toLowerCase(),
    name,
    rank: typeof rank === "number" && Number.isInteger(rank) ? rank : null,
    price: finiteNumber(row.current_price),
    market_cap: finiteNumber(row.market_cap),
    volume_24h: finiteNumber(row.total_volume),
    change_24h_pct: finiteNumber(row.price_change_percentage_24h),
  };
}

export function parsePage(payload: unknown): Coin[] {
  if (!Array.isArray(payload)) {
    throw new InvalidUpstreamPayloadError("CoinGecko returned an unexpected markets payload.");
  }
  const coins: Coin[] = [];
  for (const item of payload) {
    const coin = parseCoin(item);
    if (coin) {
      coins.push(coin);
    }
  }
  return coins;
}

export function pagePlan(startPage: number, limit: number, pageSize: number, maxPages: number): number[] {
  const pagesNeeded = Math.min(Math.max(1, Math.ceil(limit / pageSize)), maxPages);
  return Array.from({ length: pagesNeeded }, (_, offset) => startPage + offset);
}

export function buildOverview(
  coins: Coin[],
  args: {
    requestedPages: number[];
    perPage: number;
    fetchedPages: number[];
    failedPages: number[];
    currency: string;
    cache: "hit" | "miss";
    coalesced: boolean;
  },
  config: Pick<
    Config,
    | "dataSource"
    | "largeCapThreshold"
    | "midCapThreshold"
    | "marketCap1bThreshold"
    | "topMarketCapCount"
    | "topMoversCount"
  >,
): OverviewResponse {
  const unique = dedupe(coins);
  return {
    fetch: {
      requested_pages: args.requestedPages,
      per_page: args.perPage,
      fetched_pages: [...args.fetchedPages].sort((a, b) => a - b),
      failed_pages: [...args.failedPages].sort((a, b) => a - b),
      degraded: args.failedPages.length > 0,
    },
    universe: universe(unique, config),
    top_market_cap: top(unique, (coin) => coin.market_cap, config.topMarketCapCount),
    top_volume: top(unique, (coin) => coin.volume_24h, config.topMoversCount),
    top_gainers: top(
      unique.filter((coin) => (coin.change_24h_pct ?? 0) > 0),
      (coin) => coin.change_24h_pct,
      config.topMoversCount,
    ),
    top_losers: top(
      unique.filter((coin) => (coin.change_24h_pct ?? 0) < 0),
      (coin) => negate(coin.change_24h_pct),
      config.topMoversCount,
    ),
    meta: { cache: args.cache, coalesced: args.coalesced, source: config.dataSource, currency: args.currency },
  };
}

function universe(
  coins: Coin[],
  config: Pick<Config, "largeCapThreshold" | "midCapThreshold" | "marketCap1bThreshold">,
) {
  let up = 0,
    down = 0,
    flat = 0,
    unknownChange = 0;
  let gte1b = 0,
    large = 0,
    mid = 0,
    small = 0,
    unknownMarketCap = 0;
  let marketCap = 0,
    volume = 0;
  for (const coin of coins) {
    marketCap += coin.market_cap ?? 0;
    volume += coin.volume_24h ?? 0;
    const change = coin.change_24h_pct;
    if (change === null) unknownChange += 1;
    else if (change === 0) flat += 1;
    else if (change > 0) up += 1;
    else down += 1;
    const cap = coin.market_cap;
    if (cap === null) {
      unknownMarketCap += 1;
      continue;
    }
    if (cap >= config.marketCap1bThreshold) gte1b += 1;
    if (cap >= config.largeCapThreshold) large += 1;
    else if (cap >= config.midCapThreshold) mid += 1;
    else small += 1;
  }
  return {
    count: coins.length,
    market_cap: round2(marketCap),
    volume_24h: round2(volume),
    up,
    down,
    flat,
    unknown_change: unknownChange,
    market_cap_gte_1b: gte1b,
    large_cap: large,
    mid_cap: mid,
    small_cap: small,
    unknown_market_cap: unknownMarketCap,
  };
}

function top(coins: Coin[], key: (coin: Coin) => number | null, n: number): Coin[] {
  return coins
    .filter((coin) => key(coin) !== null)
    .sort((a, b) => (key(b) ?? 0) - (key(a) ?? 0))
    .slice(0, n);
}

function dedupe(coins: Coin[]): Coin[] {
  const seen = new Map<string, Coin>();
  for (const coin of coins) {
    if (!seen.has(coin.id)) seen.set(coin.id, coin);
  }
  return [...seen.values()];
}

function negate(value: number | null): number | null {
  return value === null ? null : -value;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
