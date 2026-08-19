import type { FastifyReply, FastifyRequest } from "fastify";

interface OverviewQuery {
  validatedQuery: { currency: string; page: number; limit: number };
}

export async function getOverview(request: FastifyRequest, reply: FastifyReply) {
  const { currency, page, limit } = (request as unknown as OverviewQuery).validatedQuery;
  const result = await request.server.marketService.overview({ currency, page, limit });
  reply.header("X-Cache", result.meta.cache);
  if (result.fetch.degraded) {
    reply.header("X-Degraded", "true");
  }
  return result;
}

export async function getUiConfig(request: FastifyRequest) {
  const config = request.server.config;
  return {
    currency: config.defaultCurrency,
    page: config.defaultPage,
    limit: config.uiDefaultLimit,
    maxLimit: config.maxQueryLimit,
    allowedCurrencies: config.allowedCurrencies,
  };
}
