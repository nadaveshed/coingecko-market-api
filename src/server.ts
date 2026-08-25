import { fileURLToPath, pathToFileURL } from "node:url";

import express, { type Express } from "express";

import { loadConfig } from "./config/index.js";
import { errorHandler, notFoundHandler, rateLimit, requestId } from "./middleware/index.js";
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

interface Logger {
  warn(context: Record<string, unknown>, message: string): void;
  error(error: unknown): void;
}

function createLogger(level: string): Logger {
  const silent = level === "silent";
  return {
    warn(context, message) {
      if (!silent) console.warn(JSON.stringify({ level: "warn", message, ...context }));
    },
    error(error) {
      if (!silent) console.error(error);
    },
  };
}

/** Builds the wired app without binding a port, so tests can drive it in-process. */
export async function createApp(options: AppOptions = {}): Promise<Express> {
  const config = loadConfig(options.config);
  const level =
    options.logger === false ? "silent" : typeof options.logger === "object" ? options.logger.level : config.logLevel;
  const logger = createLogger(level);

  const cache = options.cache ?? new TtlCache<OverviewResponse>(config.cacheMaxSize);
  const upstream = options.upstream ?? new CoinGeckoClient(config);
  const marketService = new MarketService(
    upstream,
    cache,
    config,
    new BoundedLimiter(config.outboundConcurrency),
    new Singleflight(),
    logger,
  );
  const rateLimiter =
    config.rateLimitMaxRequests > 0
      ? new RateLimiter(config.rateLimitMaxRequests, config.rateLimitWindowSeconds)
      : null;

  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(rateLimit(config, rateLimiter));
  app.use("/static", express.static(PUBLIC_DIR));

  registerRoutes(app, { config, marketService, publicDir: PUBLIC_DIR });

  app.use(notFoundHandler);
  app.use(errorHandler((error) => logger.error(error)));

  return app;
}

// Only bind a port when this file is executed directly, never when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const app = await createApp({ config });
  app.listen(config.port, config.host, () => {
    console.log(`listening on http://${config.host}:${config.port}`);
  });
}
