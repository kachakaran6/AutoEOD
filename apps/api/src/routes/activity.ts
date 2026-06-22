// apps/api/src/routes/activity.ts
// GET /api/activity?date=YYYY-MM-DD

import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';

export const activityRouter = Router();

activityRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const dateStr = (req.query.date as string) || DateTime.now().toISODate();

  // Validate date format
  const date = DateTime.fromISO(dateStr!);
  if (!date.isValid) {
    res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    return;
  }

  // Get user's timezone
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const tz = settings?.timezone || 'UTC';

  // Start/end of the requested date in user's timezone
  const dayStart = DateTime.fromISO(dateStr!, { zone: tz }).startOf('day');
  const dayEnd = dayStart.endOf('day');

  const events = await prisma.activityEvent.findMany({
    where: {
      userId,
      occurredAt: {
        gte: dayStart.toJSDate(),
        lte: dayEnd.toJSDate(),
      },
    },
    orderBy: { occurredAt: 'desc' },
  });

  res.json({ date: dateStr, timezone: tz, events });
});
