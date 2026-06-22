// apps/api/src/middleware/auth.ts
// Auth middleware: validates Bearer access token and attaches req.userId

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    logger.debug({ err }, 'Access token verification failed');
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
