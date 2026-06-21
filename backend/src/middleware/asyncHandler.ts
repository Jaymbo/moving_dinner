import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler so that rejected promises are forwarded to `next()`.
 * This avoids the need for manual try/catch blocks in every route with Express 4.
 */
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
>(fn: RequestHandler<P, ResBody, ReqBody, ReqQuery>): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
