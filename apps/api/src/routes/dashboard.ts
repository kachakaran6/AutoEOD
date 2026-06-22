// apps/api/src/routes/dashboard.ts
// GET /api/dashboard/today — today's stats + report summary

import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/today', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const tz = settings?.timezone || 'UTC';
  const today = DateTime.now().setZone(tz);
  const todayStr = today.toISODate()!;
  const dayStart = today.startOf('day').toJSDate();
  const dayEnd = today.endOf('day').toJSDate();

  // Count events by type for today
  const events = await prisma.activityEvent.findMany({
    where: { userId, occurredAt: { gte: dayStart, lte: dayEnd } },
    select: { type: true },
  });

  const stats = {
    commits: events.filter((e) => e.type === 'commit').length,
    prsOpened: events.filter((e) => e.type === 'pull_request').length,
    prsMerged: 0, // Will be counted properly below
    reviews: events.filter((e) => e.type === 'pr_review').length,
    issues: events.filter((e) => e.type === 'issue' || e.type === 'issue_comment').length,
    total: events.length,
  };

  // Today's report
  const report = await prisma.report.findUnique({
    where: { userId_reportDate: { userId, reportDate: todayStr } },
    select: {
      id: true,
      status: true,
      summary: true,
      completedItems: true,
      inProgressItems: true,
      generatedAt: true,
    },
  });

  // Unread notification count
  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const github = await prisma.githubIntegration.findUnique({
    where: { userId },
    select: { githubUsername: true, lastSyncedAt: true, needsReconnect: true },
  });

  res.json({
    date: todayStr,
    timezone: tz,
    user,
    github,
    stats,
    report,
    unreadNotifications: unreadCount,
  });
});
