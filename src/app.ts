import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";

import { loadConfig } from "./config/index.js";
import { registerErrorHandler, registerRateLimitHook, registerRequestIdHook } from "./middleware/index.js";
import { registerRoutes } from "./routes/index.js";
import { MarketService, CoinGeckoClient } from "./services/index.js";
import type { Config, MarketUpstream, OverviewResponse } from "./types/index.js";
import { TtlCache, BoundedLimiter, Singleflight, RateLimiter } from "./utils/index.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export interface AppOptions {
  config?: Partial<Config>;
  upstream?: MarketUpstream;
  cache?: TtlCache<OverviewResponse>;
  logger?: boolean | { level: string };
}

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    marketService: MarketService;
    rateLimiter: RateLimiter | null;
  }
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = loadConfig(options.config);
  const app = Fastify({
    logger: options.logger ?? { level: config.logLevel },
    trustProxy: config.trustProxy,
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : randomUUID();
    },
  });

  const cache = options.cache ?? new TtlCache<OverviewResponse>(config.cacheMaxSize);
  const upstream = options.upstream ?? new CoinGeckoClient(config);
  const marketService = new MarketService(
    upstream,
    cache,
    config,
    new BoundedLimiter(config.outboundConcurrency),
    new Singleflight(),
    app.log,
  );
  const rateLimiter =
    config.rateLimitMaxRequests > 0
      ? new RateLimiter(config.rateLimitMaxRequests, config.rateLimitWindowSeconds)
      : null;

  app.decorate("config", config);
  app.decorate("marketService", marketService);
  app.decorate("rateLimiter", rateLimiter);

  registerRequestIdHook(app);
  registerRateLimitHook(app, config);
  registerErrorHandler(app);
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: "not_found",
      detail: "Route not found.",
      request_id: request.id,
    }),
  );

  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: "/static/" });
  await registerRoutes(app);

  return app;
}
