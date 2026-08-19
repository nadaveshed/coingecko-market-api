import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getHealth, getReady, getOverview, getUiConfig } from "../controllers/index.js";
import { validate } from "../middleware/validate.js";
import { overviewQuerySchema } from "./schemas.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", getHealth);
  app.get("/ready", getReady);
  app.get("/api/config/ui", getUiConfig);

  const schema = overviewQuerySchema(app.config);
  app.get("/api/market/overview", { preHandler: validate(schema) }, getOverview);

  app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => reply.sendFile("index.html"));
}
