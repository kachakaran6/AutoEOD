import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '@autoeod/db';
import crypto from 'crypto';
import { logger } from '../lib/logger';

export const extensionTokensRouter = Router();

// â”€â”€ POST /api/extension-tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
extensionTokensRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  
  // Generate a random 32-byte token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const extensionToken = await prisma.extensionToken.create({
    data: {
      userId,
      tokenHash,
      label: req.body.label || 'Browser Extension',
    },
  });

  logger.info({ userId, tokenId: extensionToken.id }, 'Generated new extension token');
  
  // Return the plaintext token exactly once
  res.status(201).json({
    id: extensionToken.id,
    label: extensionToken.label,
    createdAt: extensionToken.createdAt,
    token: token, // This is the only time the user will see this
  });
});

// â”€â”€ GET /api/extension-tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
extensionTokensRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  
  const tokens = await prisma.extensionToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  res.json(tokens);
});

// â”€â”€ DELETE /api/extension-tokens/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
extensionTokensRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  const token = await prisma.extensionToken.findFirst({
    where: { id, userId },
  });

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  if (token.revokedAt) {
    res.status(400).json({ error: 'Token already revoked' });
    return;
  }

  await prisma.extensionToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId, tokenId: id }, 'Revoked extension token');
  res.json({ message: 'Token revoked' });
});
