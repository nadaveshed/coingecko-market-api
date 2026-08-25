import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const detail = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      res.status(422).json({ error: "validation_error", detail, request_id: req.id });
      return;
    }
    req.validatedQuery = result.data as Request["validatedQuery"];
    next();
  };
}
