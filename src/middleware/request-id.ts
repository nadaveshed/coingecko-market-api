import type { FastifyInstance } from "fastify";

export function registerRequestIdHook(app: FastifyInstance) {
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Request-ID", request.id);
    return payload;
  });
}
