import type { Config } from "../types/index.js";
import { RetryableUpstreamError, UpstreamTimeoutError, UpstreamUnavailableError, withRetries } from "../utils/index.js";

export class CoinGeckoClient {
  constructor(
    private readonly config: Config,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async markets(args: { vsCurrency: string; page: number; perPage: number }): Promise<unknown> {
    const url = new URL(`${this.config.coingeckoBaseUrl}${this.config.coingeckoMarketsPath}`);
    url.searchParams.set("vs_currency", args.vsCurrency);
    url.searchParams.set("order", this.config.coingeckoOrder);
    url.searchParams.set("per_page", String(args.perPage));
    url.searchParams.set("page", String(args.page));
    url.searchParams.set("sparkline", String(this.config.coingeckoSparkline));
    url.searchParams.set("price_change_percentage", this.config.coingeckoPriceChange);

    try {
      return await withRetries(() => this.get(url), {
        maxAttempts: this.config.maxAttempts,
        backoffSeconds: this.config.retryBackoffSeconds,
        shouldRetry: (error) => error instanceof RetryableUpstreamError,
        retryAfterSeconds: (error) => (error instanceof RetryableUpstreamError ? error.retryAfter : undefined),
      });
    } catch (error) {
      if (error instanceof RetryableUpstreamError) throw error.wrapped;
      throw error;
    }
  }

  private async get(url: URL): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutSeconds * 1000);
    const retryable = new Set(this.config.retryableStatusCodes);

    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": this.config.userAgent };
    if (this.config.coingeckoApiKey) {
      headers[this.config.coingeckoApiKeyHeader] = this.config.coingeckoApiKey;
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: controller.signal, headers });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new RetryableUpstreamError(new UpstreamTimeoutError("The upstream market API timed out."));
      }
      throw new RetryableUpstreamError(new UpstreamUnavailableError("Could not reach the upstream market API."));
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      throw new RetryableUpstreamError(
        new UpstreamUnavailableError("Upstream market API rate-limited the request."),
        this.retryAfter(response),
      );
    }
    if (retryable.has(response.status)) {
      throw new RetryableUpstreamError(
        new UpstreamUnavailableError(`Upstream market API returned HTTP ${response.status}.`),
      );
    }
    if (response.status >= 400) {
      throw new UpstreamUnavailableError(`Upstream market API returned HTTP ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UpstreamUnavailableError("Upstream market API returned invalid JSON.");
    }
    if (!Array.isArray(payload))
      throw new UpstreamUnavailableError("Upstream market API returned an unexpected payload shape.");
    return payload;
  }

  private retryAfter(response: Response): number {
    const header = response.headers.get("Retry-After") ?? "";
    const parsed = Number(header);
    const seconds = Number.isFinite(parsed) ? parsed : this.config.retryBackoffSeconds;
    return Math.min(Math.max(seconds, 0), this.config.maxRetryAfterSeconds);
  }
}
