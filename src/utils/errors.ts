export class AppError extends Error {
  readonly headers: Record<string, string>;

  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly detail: string,
    headers: Record<string, string> = {},
  ) {
    super(detail);
    this.name = new.target.name;
    this.headers = headers;
  }
}

export class InvalidQueryError extends AppError {
  constructor(detail: string) {
    super("invalid_query", 400, detail);
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor(detail: string) {
    super("gateway_timeout", 504, detail);
  }
}

export class UpstreamUnavailableError extends AppError {
  constructor(detail: string) {
    super("bad_gateway", 502, detail);
  }
}

export class InvalidUpstreamPayloadError extends AppError {
  constructor(detail: string) {
    super("bad_gateway", 502, detail);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(detail: string, retryAfter: number) {
    super("rate_limited", 429, detail, { "Retry-After": String(retryAfter) });
  }
}

export class RetryableUpstreamError extends Error {
  constructor(
    readonly wrapped: AppError,
    readonly retryAfter?: number,
  ) {
    super(wrapped.detail);
    this.name = "RetryableUpstreamError";
  }
}
