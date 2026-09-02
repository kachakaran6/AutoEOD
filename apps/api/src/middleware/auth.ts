// apps/api/src/middleware/auth.ts
// Auth middleware: validates Bearer access token and attaches req.userId, req.userEmail, req.userRole

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { logger, updateObservabilityContext } from '../lib/observability';
import { prisma } from '@autoeod/db';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: string;
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
    updateObservabilityContext({ userId: payload.userId });
    next();
  } catch (err) {
    logger.debug({ err }, 'Access token verification failed');
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.userEmail = user.email;
    req.userRole = user.role;
    updateObservabilityContext({ userEmail: user.email, userRole: user.role });
    next();
  } catch (err) {
    logger.error({ err }, 'Admin check failed');
    res.status(500).json({ error: 'Internal server error' });
  }
}

