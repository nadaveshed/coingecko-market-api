import type { Express, Request, Response } from "express";

import { getHealth, getReady, getOverview, getUiConfig } from "../controllers/index.js";
import { validate } from "../middleware/index.js";
import type { MarketService } from "../services/index.js";
import type { Config } from "../types/index.js";
import { overviewQuerySchema } from "./schemas.js";

export function registerRoutes(
  app: Express,
  deps: { config: Config; marketService: MarketService; publicDir: string },
): void {
  app.get("/health", getHealth);
  app.get("/ready", getReady);
  app.get("/api/config/ui", getUiConfig(deps.config));

  app.get("/api/market/overview", validate(overviewQuerySchema(deps.config)), getOverview(deps.marketService));

  app.get("/", (_req: Request, res: Response) => {
    res.sendFile("index.html", { root: deps.publicDir });
  });
}
