import type { NextFunction, Request, Response } from "express";

import type { Config } from "../types/index.js";
import type { RateLimiter } from "../utils/index.js";

export function rateLimit(config: Config, limiter: RateLimiter | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const exempt = config.rateLimitExemptPaths.includes(req.path) || req.path.startsWith(config.rateLimitExemptPrefix);
    if (!limiter || exempt) {
      next();
      return;
    }

    const { allowed, retryAfter } = limiter.check(req.ip || "anonymous");
    if (allowed) {
      next();
      return;
    }

    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "rate_limited",
      detail: "Too many requests. Try again later.",
      request_id: req.id,
    });
  };
}
