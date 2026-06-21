import { Application } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { config } from '../config.js';

/**
 * Applies security hardening middleware to the Express app.
 */
export function applySecurityMiddleware(app: Application) {
  // CORS – restrict in production, allow localhost in dev
  const corsOrigins = config.isProduction
    ? [config.baseUrl]
    : ['http://localhost:3000', 'http://localhost:3003', config.baseUrl];

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Rate limiting – stricter for auth routes
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.', code: 'RATE_LIMITED' },
    skipSuccessfulRequests: true,
  });

  app.use(generalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  // Trust proxy in production (for correct client IP behind nginx)
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // Remove Express server header
  app.disable('x-powered-by');
}
