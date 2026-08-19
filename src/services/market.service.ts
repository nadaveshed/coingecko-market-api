import type { Config, Coin, MarketUpstream, OverviewResponse } from "../types/index.js";
import {
  AppError,
  InvalidQueryError,
  UpstreamTimeoutError,
  UpstreamUnavailableError,
  TtlCache,
  BoundedLimiter,
  Singleflight,
  buildOverview,
  pagePlan,
  parsePage,
} from "../utils/index.js";

interface MarketLogger {
  warn(context: Record<string, unknown>, message: string): void;
}

export class MarketService {
  constructor(
    private readonly upstream: MarketUpstream,
    private readonly cache: TtlCache<OverviewResponse>,
    private readonly config: Config,
    private readonly limiter: BoundedLimiter,
    private readonly singleflight: Singleflight,
    private readonly logger?: MarketLogger,
  ) {}

  async overview(args: { currency: string; page: number; limit: number }): Promise<OverviewResponse> {
    const vs = this.normalizeCurrency(args.currency);
    const startPage = positive("page", args.page);
    const total = positive("limit", args.limit);
    const pages = pagePlan(startPage, total, this.config.defaultPageSize, this.config.maxPages);
    const cacheKey = `overview:${vs}:${startPage}:${total}:${this.config.defaultPageSize}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, meta: { ...cached.meta, cache: "hit", coalesced: false } };
    }

    const { value, coalesced } = await this.singleflight.do(cacheKey, () => this.load(vs, pages, total, cacheKey));
    if (coalesced) return { ...value, meta: { ...value.meta, coalesced: true } };
    return value;
  }

  private async load(vsCurrency: string, pages: number[], limit: number, cacheKey: string): Promise<OverviewResponse> {
    const results = await Promise.allSettled(pages.map((pageNo) => this.fetchPage(vsCurrency, pageNo)));

    const coins: Coin[] = [];
    const fetched: number[] = [];
    const failed: number[] = [];
    const failures: AppError[] = [];
    for (const [index, result] of results.entries()) {
      const pageNo = pages[index];
      if (pageNo === undefined) continue;
      if (result.status === "fulfilled") {
        fetched.push(pageNo);
        coins.push(...result.value);
        continue;
      }
      if (!(result.reason instanceof AppError)) throw result.reason;
      failed.push(pageNo);
      failures.push(result.reason);
      this.logger?.warn(
        { error: result.reason.code, detail: result.reason.detail, page: pageNo, currency: vsCurrency },
        "CoinGecko page fetch failed",
      );
    }

    if (fetched.length === 0) {
      if (failures.length > 0 && failures.every((error) => error instanceof UpstreamTimeoutError)) {
        throw new UpstreamTimeoutError("All requested CoinGecko pages timed out.");
      }
      throw new UpstreamUnavailableError("No market pages could be fetched from CoinGecko.");
    }

    const overview = buildOverview(
      coins.slice(0, limit),
      {
        requestedPages: pages,
        fetchedPages: fetched,
        failedPages: failed,
        currency: vsCurrency,
        cache: "miss",
        coalesced: false,
      },
      this.config,
    );
    this.cache.set(cacheKey, overview, this.config.cacheTtlSeconds);
    return overview;
  }

  private async fetchPage(vsCurrency: string, page: number): Promise<Coin[]> {
    const raw = await this.limiter.run(() =>
      this.upstream.markets({ vsCurrency, page, perPage: this.config.defaultPageSize }),
    );
    return parsePage(raw);
  }

  private normalizeCurrency(value: string): string {
    const cleaned = value.trim().toLowerCase();
    if (!this.config.allowedCurrencies.includes(cleaned)) {
      throw new InvalidQueryError(`currency must be one of ${this.config.allowedCurrencies.join(", ")}.`);
    }
    return cleaned;
  }
}

function positive(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new InvalidQueryError(`${name} must be >= 1.`);
  return value;
}
