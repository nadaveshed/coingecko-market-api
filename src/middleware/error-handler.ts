import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "not_found", detail: "Route not found.", request_id: req.id });
}

export function errorHandler(logError: (error: unknown) => void) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof AppError) {
      for (const [key, value] of Object.entries(error.headers)) {
        res.setHeader(key, value);
      }
      res.status(error.statusCode).json({ error: error.code, detail: error.detail, request_id: req.id });
      return;
    }

    logError(error);
    res.status(500).json({ error: "internal_error", detail: "Internal server error.", request_id: req.id });
  };
}
