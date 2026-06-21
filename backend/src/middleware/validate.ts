import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, z } from 'zod';
import { ValidationError } from './errorHandler.js';

/** Inferred parameter type for a Zod schema used with validateParams. */
export type InferParams<S extends ZodSchema> = z.infer<S>;

/** Returns typed request params after they have been validated by validateParams. */
export function typedParams<S extends ZodSchema>(req: Request, _schema: S): z.infer<S> {
  return req.params as unknown as z.infer<S>;
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(formatZodError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T extends Record<string, unknown>>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError(formatZodError(result.error)));
      return;
    }
    req.params = result.data as unknown as Request['params'];
    next();
  };
}

export function validateQuery<T extends Record<string, unknown>>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError(formatZodError(result.error)));
      return;
    }
    req.query = result.data as unknown as Request['query'];
    next();
  };
}

function formatZodError(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'root';
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(issue.message);
  }
  return result;
}
