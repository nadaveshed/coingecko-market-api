import type { Config } from "../types/index.js";
import { AppError, UpstreamTimeoutError, UpstreamUnavailableError, withRetries } from "../utils/index.js";

const MARKETS_PATH = "/coins/markets";
const ORDER = "market_cap_desc";
const PRICE_CHANGE = "24h";
const API_KEY_HEADER = "x-cg-demo-api-key";
const USER_AGENT = "coingecko-market-api/1.0";

/** Marks an error as worth retrying, so call sites read `throw retryable(new ...)`. */
function retryable<E extends AppError>(error: E, retryAfter?: number): E {
  error.retryable = true;
  error.retryAfter = retryAfter;
  return error;
}

export class CoinGeckoClient {
  constructor(
    private readonly config: Config,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async markets(args: { vsCurrency: string; page: number; perPage: number }): Promise<unknown> {
    const url = new URL(`${this.config.coingeckoBaseUrl}${MARKETS_PATH}`);
    url.searchParams.set("vs_currency", args.vsCurrency);
    url.searchParams.set("order", ORDER);
    url.searchParams.set("per_page", String(args.perPage));
    url.searchParams.set("page", String(args.page));
    url.searchParams.set("sparkline", "false");
    url.searchParams.set("price_change_percentage", PRICE_CHANGE);

    return withRetries(() => this.get(url), {
      maxAttempts: this.config.maxAttempts,
      backoffSeconds: this.config.retryBackoffSeconds,
      shouldRetry: (error) => error instanceof AppError && error.retryable,
      retryAfterSeconds: (error) => (error instanceof AppError ? error.retryAfter : undefined),
    });
  }

  private async get(url: URL): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutSeconds * 1000);

    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT };
    if (this.config.coingeckoApiKey) {
      headers[API_KEY_HEADER] = this.config.coingeckoApiKey;
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: controller.signal, headers });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw retryable(new UpstreamTimeoutError("The upstream market API timed out."));
      }
      throw retryable(new UpstreamUnavailableError("Could not reach the upstream market API."));
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      throw retryable(
        new UpstreamUnavailableError("Upstream market API rate-limited the request."),
        this.retryAfter(response),
      );
    }
    if (this.config.retryableStatusCodes.includes(response.status)) {
      throw retryable(new UpstreamUnavailableError(`Upstream market API returned HTTP ${response.status}.`));
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
    if (!Array.isArray(payload)) {
      throw new UpstreamUnavailableError("Upstream market API returned an unexpected payload shape.");
    }
    return payload;
  }

  private retryAfter(response: Response): number {
    const header = response.headers.get("Retry-After") ?? "";
    const parsed = Number(header);
    const seconds = Number.isFinite(parsed) ? parsed : this.config.retryBackoffSeconds;
    return Math.min(Math.max(seconds, 0), this.config.maxRetryAfterSeconds);
  }
}
