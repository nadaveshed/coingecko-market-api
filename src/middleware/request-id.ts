import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["x-request-id"];
  req.id = typeof header === "string" && header.length > 0 ? header : randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
}
