import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Structured application error.
 * Allows routes to throw errors with a specific HTTP status and safe client message.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Zod validation error wrapper.
 */
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(details: Record<string, string[]>) {
    super('Validation failed', 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Central Express error handler.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Operational errors we want to expose to the client
  if (err instanceof AppError && err.isOperational) {
    const body: { error: string; code: string; details?: Record<string, string[]> } = {
      error: err.message,
      code: err.code,
    };
    if (err instanceof ValidationError) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Log everything else as an unexpected error
  logger.error(
    'Unexpected error',
    err instanceof Error ? { message: err.message, stack: err.stack } : { err }
  );

  res.status(500).json({
    error: config.isProduction ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}
