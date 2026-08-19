import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodSchema, ZodError } from "zod";

export function validate<T>(schema: ZodSchema<T>) {
  return (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const zodError = result.error as ZodError;
      const detail = zodError.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      reply.status(422).send({
        error: "validation_error",
        detail,
        request_id: request.id,
      });
      return;
    }
    (request as unknown as { validatedQuery: T }).validatedQuery = result.data;
    done();
  };
}
