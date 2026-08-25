import type { FastifyReply, FastifyRequest } from "fastify";

interface OverviewQuery {
  validatedQuery: { currency: string; page: number; per_page: number; limit: number };
}

export async function getOverview(request: FastifyRequest, reply: FastifyReply) {
  const { currency, page, per_page: perPage, limit } = (request as unknown as OverviewQuery).validatedQuery;
  const result = await request.server.marketService.overview({ currency, page, perPage, limit });
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
    perPage: config.defaultPageSize,
    maxPerPage: config.maxQueryPerPage,
    allowedCurrencies: config.allowedCurrencies,
  };
}
