// apps/api/src/routes/reports.ts
// Report CRUD + generate + send endpoints

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { Queue } from 'bullmq';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';
import { redisConnection } from '../lib/redis';
import { sendReportEmail } from '../lib/email';

export const reportsRouter = Router();

const generateReportQueue = new Queue('generate-report', { connection: redisConnection as any });

// ── POST /api/reports/generate ────────────────────────────────────────────────
reportsRouter.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const tz = settings?.timezone || 'UTC';
  const today = DateTime.now().setZone(tz).toISODate()!;

  const job = await generateReportQueue.add(
    'generate-report',
    { userId, reportDate: today, manual: true },
    { jobId: `gen-${userId}-${today}-${Date.now()}`, attempts: 2, backoff: { type: 'fixed', delay: 5000 } }
  );

  logger.info({ userId, jobId: job.id, date: today }, 'Manual report generation enqueued');
  res.json({ message: 'Report generation queued', jobId: job.id, date: today });
});

// ── GET /api/reports/:date ─────────────────────────────────────────────────────
reportsRouter.get('/:date', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const date = req.params.date as string;

  if (!DateTime.fromISO(date).isValid) {
    res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    return;
  }

  const report = await prisma.report.findUnique({
    where: { userId_reportDate: { userId, reportDate: date } },
  });

  if (!report) {
    res.status(404).json({ error: 'Report not found for this date' });
    return;
  }

  res.json(report);
});

// ── PATCH /api/reports/:id ─────────────────────────────────────────────────────
const PatchReportSchema = z.object({
  summary: z.string().optional(),
  completedItems: z.array(z.string()).optional(),
  inProgressItems: z.array(z.string()).optional(),
  blockers: z.string().nullable().optional(),
  tomorrowPlan: z.string().optional(),
});

reportsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  const parse = PatchReportSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  // Verify ownership
  const report = await prisma.report.findFirst({ where: { id, userId } });
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (report.status === 'sent') {
    res.status(400).json({ error: 'Cannot edit a report that has already been sent' });
    return;
  }

  const updated = await prisma.report.update({
    where: { id },
    data: { ...parse.data, status: 'draft' },
  });

  res.json(updated);
});

// ── POST /api/reports/:id/regenerate ─────────────────────────────────────────
reportsRouter.post('/:id/regenerate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  const report = await prisma.report.findFirst({ where: { id, userId } });
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const job = await generateReportQueue.add(
    'generate-report',
    { userId, reportDate: report.reportDate, manual: true, reportId: id },
    { jobId: `regen-${userId}-${report.reportDate}-${Date.now()}`, attempts: 2, backoff: { type: 'fixed', delay: 5000 } }
  );

  logger.info({ userId, jobId: job.id, reportDate: report.reportDate }, 'Report regeneration enqueued');
  res.json({ message: 'Report regeneration queued', jobId: job.id });
});

// ── POST /api/reports/:id/send ────────────────────────────────────────────────
reportsRouter.post('/:id/send', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  const report = await prisma.report.findFirst({ where: { id, userId } });
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (report.status === 'sent') {
    res.status(400).json({ error: 'Report has already been sent' });
    return;
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.managerEmail) {
    res.status(400).json({
      error: 'No manager email configured. Please set your manager email in Settings before sending.',
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  try {
    await sendReportEmail({
      report,
      senderName: user?.name || 'Team Member',
      managerEmail: settings.managerEmail,
      ccEmails: settings.ccEmails || undefined,
    });

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentTo: settings.managerEmail,
        errorMessage: null,
      },
    });

    logger.info({ userId, reportId: id, sentTo: settings.managerEmail }, 'Report sent');
    res.json(updated);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Email sending failed';
    await prisma.report.update({
      where: { id },
      data: { status: 'failed', errorMessage },
    });
    logger.error({ err, userId, reportId: id }, 'Report send failed');
    res.status(500).json({ error: 'Failed to send report email', details: errorMessage });
  }
});

// ── GET /api/reports (list) ────────────────────────────────────────────────────
reportsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

  const reports = await prisma.report.findMany({
    where: { userId },
    orderBy: { reportDate: 'desc' },
    take: limit,
    select: {
      id: true,
      reportDate: true,
      status: true,
      summary: true,
      generatedAt: true,
      sentAt: true,
    },
  });

  res.json(reports);
});
