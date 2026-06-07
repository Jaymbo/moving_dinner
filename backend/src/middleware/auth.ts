import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../db';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

/**
 * JWT-based auth middleware.
 * Reads Authorization: Bearer <token> and attaches userId to req.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth: attaches userId if token present, but doesn't fail if missing.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: number };
      req.userId = payload.userId;
    } catch {
      // ignore – no auth
    }
  }
  next();
}

/**
 * Generate a JWT for a user.
 */
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

/**
 * Admin-only middleware (checks if user is admin of a specific group or is a super-admin).
 * For now: any authenticated user can be admin – group-specific checks are in groupAuth.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // TODO: Add real admin role check when super-admin concept is finalized
  next();
}