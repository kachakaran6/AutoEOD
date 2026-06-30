import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';

export const holidaysRouter = Router();

// GET /api/holidays
holidaysRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const holidays = await prisma.holiday.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
  res.json(holidays);
});

// POST /api/holidays
holidaysRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().min(1),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const holiday = await prisma.holiday.create({
    data: {
      userId,
      date: parse.data.date,
      name: parse.data.name,
    }
  });

  res.json(holiday);
});

// DELETE /api/holidays/:id
holidaysRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  try {
    await prisma.holiday.delete({
      where: { id, userId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

// GET /api/holidays/skip-logs
holidaysRouter.get('/skip-logs', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const logs = await prisma.reportSkipLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 50,
  });
  res.json(logs);
});
