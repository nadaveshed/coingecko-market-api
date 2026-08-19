import { createApp, type AppOptions } from "../src/app.js";
import type { Config } from "../src/types/index.js";
import { FakeUpstream } from "./fakes.js";

export function testConfig(overrides: Partial<Config> = {}): Partial<Config> {
  return {
    maxAttempts: 1,
    retryBackoffSeconds: 0,
    cacheTtlSeconds: 60,
    rateLimitMaxRequests: 0,
    defaultPageSize: 2,
    maxPages: 5,
    outboundConcurrency: 2,
    logLevel: "silent",
    ...overrides,
  };
}

export function buildApp(options: AppOptions = {}) {
  return createApp({
    logger: false,
    config: testConfig(options.config),
    upstream: options.upstream ?? new FakeUpstream(),
    cache: options.cache,
  });
}
