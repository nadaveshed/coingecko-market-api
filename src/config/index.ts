import { loadEnvFile } from "node:process";

import type { Config } from "../types/index.js";

export const defaults: Config = {
  coingeckoBaseUrl: "https://api.coingecko.com/api/v3",
  coingeckoApiKey: "",
  coingeckoApiKeyHeader: "x-cg-demo-api-key",
  coingeckoMarketsPath: "/coins/markets",
  coingeckoOrder: "market_cap_desc",
  coingeckoSparkline: false,
  coingeckoPriceChange: "24h",
  requestTimeoutSeconds: 8,
  maxAttempts: 3,
  retryBackoffSeconds: 0.4,
  maxRetryAfterSeconds: 3,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  cacheTtlSeconds: 30,
  cacheMaxSize: 64,
  outboundConcurrency: 2,
  maxPages: 5,
  defaultPageSize: 100,
  rateLimitMaxRequests: 30,
  rateLimitWindowSeconds: 60,
  rateLimitExemptPaths: ["/", "/health", "/ready", "/api/config/ui"],
  rateLimitExemptPrefix: "/static",
  trustProxy: false,
  allowedCurrencies: ["usd", "eur", "gbp", "ils"],
  defaultCurrency: "usd",
  defaultPage: 1,
  defaultLimit: 100,
  maxQueryPage: 20,
  maxQueryLimit: 500,
  uiDefaultLimit: 200,
  largeCapThreshold: 10_000_000_000,
  midCapThreshold: 1_000_000_000,
  marketCap1bThreshold: 1_000_000_000,
  topMarketCapCount: 20,
  topMoversCount: 10,
  dataSource: "coingecko",
  userAgent: "market-overview-api/1.0",
  logLevel: "info",
  host: "0.0.0.0",
  port: 8000,
};

let envLoaded = false;

export function loadConfig(overrides: Partial<Config> = {}): Config {
  ensureEnvLoaded();
  return {
    ...defaults,
    coingeckoBaseUrl: envString("APP_COINGECKO_BASE_URL", defaults.coingeckoBaseUrl),
    coingeckoApiKey: envString("APP_COINGECKO_API_KEY", defaults.coingeckoApiKey),
    trustProxy: envBoolean("APP_TRUST_PROXY", defaults.trustProxy),
    ...overrides,
  };
}

function ensureEnvLoaded(): void {
  if (envLoaded) {
    return;
  }
  envLoaded = true;
  try {
    loadEnvFile();
  } catch {
    // .env is optional
  }
}

function envString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}
