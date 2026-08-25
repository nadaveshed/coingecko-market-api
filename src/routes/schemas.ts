import { z } from "zod";

import type { Config } from "../types/index.js";

export function overviewQuerySchema(config: Config) {
  return z.object({
    currency: z
      .string()
      .min(3)
      .max(3)
      .default(config.defaultCurrency)
      .transform((v) => v.toLowerCase()),
    page: z.coerce.number().int().min(1).max(config.maxQueryPage).default(config.defaultPage),
    per_page: z.coerce.number().int().min(1).max(config.maxQueryPerPage).default(config.defaultPageSize),
    limit: z.coerce.number().int().min(1).max(config.maxQueryLimit).default(config.defaultLimit),
  });
}

export type OverviewQuery = z.infer<ReturnType<typeof overviewQuerySchema>>;
