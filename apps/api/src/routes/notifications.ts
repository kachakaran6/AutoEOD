// apps/api/src/routes/notifications.ts

import { Router, Request, Response } from 'express';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(notifications);
});

// POST /api/notifications/mark-read
notificationsRouter.post('/mark-read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { ids } = req.body as { ids?: string[] };

  if (ids && Array.isArray(ids)) {
    await prisma.notification.updateMany({
      where: { userId, id: { in: ids } },
      data: { read: true },
    });
  } else {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  res.json({ message: 'Notifications marked as read' });
});
