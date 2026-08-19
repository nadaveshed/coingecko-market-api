import type { FastifyError, FastifyInstance } from "fastify";

import { AppError } from "../utils/errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      for (const [key, value] of Object.entries(error.headers)) {
        reply.header(key, value);
      }
      return reply.status(error.statusCode).send({
        error: error.code,
        detail: error.detail,
        request_id: request.id,
      });
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.validation || fastifyError.code === "FST_ERR_VALIDATION") {
      return reply.status(422).send({
        error: "validation_error",
        detail: "Request validation failed.",
        request_id: request.id,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: "internal_error",
      detail: "Internal server error.",
      request_id: request.id,
    });
  });
}
