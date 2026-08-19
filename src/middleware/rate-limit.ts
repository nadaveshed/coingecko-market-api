import type { FastifyInstance } from "fastify";

import type { Config } from "../types/index.js";

export function registerRateLimitHook(app: FastifyInstance, config: Config) {
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (config.rateLimitExemptPaths.includes(path) || path.startsWith(config.rateLimitExemptPrefix)) {
      return;
    }
    if (!app.rateLimiter) {
      return;
    }
    const { allowed, retryAfter } = app.rateLimiter.check(request.ip || "anonymous");
    if (!allowed) {
      return reply
        .status(429)
        .header("Retry-After", String(retryAfter))
        .send({ error: "rate_limited", detail: "Too many requests. Try again later.", request_id: request.id });
    }
  });
}
