import { Router, Request, Response } from 'express';
import { prisma } from '@autoeod/db';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

export const activityLogRouter = Router();
activityLogRouter.use(requireAuth);

const QuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? parseInt(v) : 1)),
  limit: z.string().optional().transform(v => (v ? parseInt(v) : 50)),
  domain: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  tier: z.string().optional().transform(v => (v ? parseInt(v) : undefined)),
  selectedOnly: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

// GET /api/activity-log
activityLogRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = QuerySchema.safeParse(req.query as any);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params' });
    return;
  }

  const { page, limit, domain, date, tier, selectedOnly } = parsed.data;
  
  const where: any = { userId };
  
  if (domain) where.domain = { contains: domain, mode: 'insensitive' };
  if (tier !== undefined) where.captureTier = tier;
  if (selectedOnly) where.selected = true;
  
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.tabOpenedAt = { gte: start, lte: end };
  }

  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.browserActivityLog.count({ where }),
    prisma.browserActivityLog.findMany({
      where,
      orderBy: { tabOpenedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: logs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// PATCH /api/activity-log/:id
activityLogRouter.patch('/:id', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { selected } = req.body;

  if (typeof selected !== 'boolean') {
    res.status(400).json({ error: 'selected must be a boolean' });
    return;
  }

  const log = await prisma.browserActivityLog.findUnique({ where: { id: id as string } });
  if (!log || log.userId !== userId) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const updated = await prisma.browserActivityLog.update({
    where: { id: id as string },
    data: { selected },
  });

  res.json(updated);
});

// POST /api/activity-log/bulk-select
activityLogRouter.post('/bulk-select', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { domain, date, selected } = req.body;

  if (typeof selected !== 'boolean') {
    res.status(400).json({ error: 'selected must be a boolean' });
    return;
  }

  const where: any = { userId, promotedToEventId: null };
  if (domain) where.domain = domain;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.tabOpenedAt = { gte: start, lte: end };
  }

  const result = await prisma.browserActivityLog.updateMany({
    where,
    data: { selected },
  });

  res.json({ updatedCount: result.count });
});

// DELETE /api/activity-log
activityLogRouter.delete('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { beforeDate } = req.body; // YYYY-MM-DD

  if (!beforeDate) {
    res.status(400).json({ error: 'beforeDate is required' });
    return;
  }

  const dateLimit = new Date(`${beforeDate}T00:00:00.000Z`);
  const result = await prisma.browserActivityLog.deleteMany({
    where: {
      userId,
      tabOpenedAt: { lt: dateLimit },
    },
  });

  res.json({ deletedCount: result.count });
});

// POST /api/activity-log/promote
activityLogRouter.post('/promote', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { ids, date } = req.body; // promote specific ids OR all selected for a date

  const where: any = { userId, selected: true, promotedToEventId: null };
  if (ids && Array.isArray(ids)) {
    where.id = { in: ids };
  } else if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.tabOpenedAt = { gte: start, lte: end };
  } else {
    res.status(400).json({ error: 'Must provide ids array or a date string' });
    return;
  }

  const logsToPromote = await prisma.browserActivityLog.findMany({ where });
  if (logsToPromote.length === 0) {
    res.json({ promotedCount: 0 });
    return;
  }

  let promotedCount = 0;
  for (const log of logsToPromote) {
    // Determine title
    let title = log.pageTitle;
    if (log.captureTier === 2 && log.adapterPayload && typeof log.adapterPayload === 'object') {
      const payload = log.adapterPayload as any;
      if (payload.title) title = payload.title;
    }

    const event = await prisma.activityEvent.create({
      data: {
        userId,
        source: 'browser',
        type: log.captureTier === 2 ? 'chatgpt_conversation' : 'browser_activity',
        externalId: `browser-${log.id}`,
        repo: '',
        title,
        url: log.url,
        occurredAt: log.tabOpenedAt,
        rawPayload: JSON.parse(JSON.stringify(log)), // Safe JSON
      },
    });

    await prisma.browserActivityLog.update({
      where: { id: log.id },
      data: { promotedToEventId: event.id },
    });

    promotedCount++;
  }

  res.json({ promotedCount });
});
