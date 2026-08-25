import request from "supertest";

import { createApp } from "../src/server.js";
import type { AppOptions } from "../src/types/index.js";
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

interface InjectOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
}

interface InjectResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors supertest's untyped response.body
  json(): any;
}

export interface TestApp {
  inject(options: InjectOptions): Promise<InjectResponse>;
  close(): Promise<void>;
}

/**
 * Keeps the Fastify-era `app.inject(...)` shape on top of supertest, so the
 * assertions in the test files stay identical after the Express migration.
 */
export async function buildApp(options: AppOptions = {}): Promise<TestApp> {
  const app = await createApp({
    logger: false,
    config: testConfig(options.config),
    upstream: options.upstream ?? new FakeUpstream(),
    cache: options.cache,
  });

  return {
    async inject({ method, url, headers = {} }: InjectOptions): Promise<InjectResponse> {
      const verb = method.toLowerCase() as "get";
      let pending = request(app)[verb](url);
      for (const [key, value] of Object.entries(headers)) {
        pending = pending.set(key, value);
      }
      const response = await pending;
      return {
        statusCode: response.status,
        headers: response.headers as Record<string, string>,
        body: response.text,
        json: () => response.body,
      };
    },
    async close(): Promise<void> {},
  };
}
