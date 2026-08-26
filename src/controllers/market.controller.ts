import type { Request, Response } from "express";

import type { MarketService } from "../services/index.js";
import type { Config } from "../types/index.js";

export function getOverview(marketService: MarketService) {
  return async (req: Request, res: Response): Promise<void> => {
    const { currency, page, per_page: perPage, limit } = req.validatedQuery;
    const result = await marketService.overview({ currency, page, perPage, limit });

    res.setHeader("X-Cache", result.meta.cache);
    if (result.fetch.degraded) {
      res.setHeader("X-Degraded", "true");
    }
    res.json(result);
  };
}

export function createUiConfigHandler(config: Config) {
  return (_req: Request, res: Response): void => {
    res.json({
      currency: config.defaultCurrency,
      page: config.defaultPage,
      limit: config.uiDefaultLimit,
      maxLimit: config.maxQueryLimit,
      perPage: config.defaultPageSize,
      maxPerPage: config.maxQueryPerPage,
      allowedCurrencies: config.allowedCurrencies,
    });
  };
}
