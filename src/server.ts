import { fileURLToPath, pathToFileURL } from "node:url";

import express, { type Express } from "express";

import { loadConfig } from "./config/index.js";
import { errorHandler, notFoundHandler, rateLimit, requestId } from "./middleware/index.js";
import { registerRoutes } from "./routes/index.js";
import { MarketService, CoinGeckoClient } from "./services/index.js";
import type { AppOptions, OverviewResponse } from "./types/index.js";
import { TtlCache, BoundedLimiter, Singleflight, RateLimiter, createLogger } from "./utils/index.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

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
