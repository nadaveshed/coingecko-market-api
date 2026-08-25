export interface Config {
  coingeckoBaseUrl: string;
  coingeckoApiKey: string;
  coingeckoApiKeyHeader: string;
  coingeckoMarketsPath: string;
  coingeckoOrder: string;
  coingeckoSparkline: boolean;
  coingeckoPriceChange: string;
  requestTimeoutSeconds: number;
  maxAttempts: number;
  retryBackoffSeconds: number;
  maxRetryAfterSeconds: number;
  retryableStatusCodes: number[];
  cacheTtlSeconds: number;
  cacheMaxSize: number;
  outboundConcurrency: number;
  maxPages: number;
  defaultPageSize: number;
  rateLimitMaxRequests: number;
  rateLimitWindowSeconds: number;
  rateLimitExemptPaths: string[];
  rateLimitExemptPrefix: string;
  trustProxy: boolean;
  allowedCurrencies: string[];
  defaultCurrency: string;
  defaultPage: number;
  defaultLimit: number;
  maxQueryPage: number;
  maxQueryLimit: number;
  maxQueryPerPage: number;
  uiDefaultLimit: number;
  largeCapThreshold: number;
  midCapThreshold: number;
  marketCap1bThreshold: number;
  topMarketCapCount: number;
  topMoversCount: number;
  dataSource: string;
  userAgent: string;
  logLevel: string;
  host: string;
  port: number;
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  price: number | null;
  market_cap: number | null;
  volume_24h: number | null;
  change_24h_pct: number | null;
}

export interface CoinGeckoMarketRow {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  market_cap_rank?: unknown;
  current_price?: unknown;
  market_cap?: unknown;
  total_volume?: unknown;
  price_change_percentage_24h?: unknown;
  [key: string]: unknown;
}

export interface FetchStatus {
  requested_pages: number[];
  per_page: number;
  fetched_pages: number[];
  failed_pages: number[];
  degraded: boolean;
}

export interface UniverseStats {
  count: number;
  market_cap: number;
  volume_24h: number;
  up: number;
  down: number;
  flat: number;
  unknown_change: number;
  market_cap_gte_1b: number;
  large_cap: number;
  mid_cap: number;
  small_cap: number;
  unknown_market_cap: number;
}

export interface ResponseMeta {
  cache: "hit" | "miss";
  coalesced: boolean;
  source: string;
  currency: string;
}

export interface OverviewResponse {
  fetch: FetchStatus;
  universe: UniverseStats;
  top_market_cap: Coin[];
  top_volume: Coin[];
  top_gainers: Coin[];
  top_losers: Coin[];
  meta: ResponseMeta;
}

export interface ErrorResponse {
  error: string;
  detail: string;
  request_id: string;
}

export interface MarketUpstream {
  markets(args: { vsCurrency: string; page: number; perPage: number }): Promise<unknown>;
}
