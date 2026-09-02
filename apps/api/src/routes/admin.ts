// apps/api/src/routes/admin.ts
// Enterprise Observability, Logging, Tracing, Audit, Metrics, Health & Management Router

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { prisma } from '@autoeod/db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getOrCreateSystemConfig } from './config';
import { redisConnection } from '../lib/redis';
import { Queue } from 'bullmq';
import {
  logger,
  logStore,
  traceStore,
  metricsEngine,
  ErrorTracker,
  AuditService,
  SecurityService,
  AlertEngine,
  RetentionService,
  ExportService,
  EventTaxonomy,
  maskEmail,
} from '../lib/observability';

export const adminRouter = Router();

// Guard all admin routes
adminRouter.use(requireAuth, requireAdmin);

// Queue instances for status checking & job introspection
const queueInstances: Record<string, Queue> = {
  'github-sync': new Queue('github-sync', { connection: redisConnection as any }),
  'schedule-dispatcher': new Queue('schedule-dispatcher', { connection: redisConnection as any }),
  'generate-report': new Queue('generate-report', { connection: redisConnection as any }),
  'send-report': new Queue('send-report', { connection: redisConnection as any }),
};

function parseRedisInfo(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
      const [key, val] = trimmed.split(':');
      result[key.trim()] = val.trim();
    }
  }
  return result;
}

// ── 1. OBSERVABILITY OVERVIEW ──────────────────────────────────────────────────
adminRouter.get('/observability/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const metricsSnapshot = metricsEngine.getSnapshot();

    // Check subsystem health
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'unhealthy';
    }

    let redisStatus = 'healthy';
    let redisLatencyMs = 0;
    try {
      const start = Date.now();
      await redisConnection.ping();
      redisLatencyMs = Date.now() - start;
    } catch {
      redisStatus = 'unhealthy';
    }

    // Counts from database
    const [
      activeUsersCount,
      reportsTodayCount,
      activeAlertsCount,
      unresolvedErrorsCount,
      securityEventsTodayCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.report.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      prisma.alertIncident.count({ where: { status: 'TRIGGERED' } }),
      prisma.errorGroup.count({ where: { status: 'UNRESOLVED' } }),
      prisma.securityEvent.count({
        where: { timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    // Background job queue counts
    const queueCounts: Record<string, any> = {};
    for (const [name, q] of Object.entries(queueInstances)) {
      try {
        queueCounts[name] = await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
      } catch {
        queueCounts[name] = { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 };
      }
    }

    res.json({
      systemHealth: {
        overall: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded',
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
        queues: queueCounts,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      requests: metricsSnapshot.requests,
      latency: metricsSnapshot.latency,
      comparison: metricsSnapshot.comparison,
      usage: {
        totalUsers: activeUsersCount,
        reportsToday: reportsTodayCount,
        aiCalls: metricsSnapshot.ai.total,
        aiFallbacks: metricsSnapshot.ai.fallbacks,
        backgroundJobs: metricsSnapshot.jobs.total,
        failedJobs: metricsSnapshot.jobs.failed,
      },
      security: {
        securityEventsToday: securityEventsTodayCount,
        activeAlerts: activeAlertsCount,
      },
      errors: {
        unresolvedErrorGroups: unresolvedErrorsCount,
      },
      timeSeries: metricsSnapshot.timeSeries,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to generate observability overview');
    res.status(500).json({ error: 'Failed to generate observability overview' });
  }
});

// ── 2. LOGS EXPLORER (Application, API, Security, AI, Jobs, Integrations, Email) ───
adminRouter.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const level = req.query.level as string | undefined;
    const service = req.query.service as string | undefined;
    const category = req.query.category as string | undefined;
    const traceId = req.query.traceId as string | undefined;
    const requestId = req.query.requestId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;
    const search = req.query.search as string | undefined;
    const startTime = req.query.startTime as string | undefined;
    const endTime = req.query.endTime as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const queryResult = logStore.query({
      level,
      service,
      category,
      traceId,
      requestId,
      userId,
      action,
      search,
      startTime,
      endTime,
      page,
      limit,
    });

    res.json(queryResult);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch logs from LogStore');
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ── 3. TRACES & WATERFALL LIFECYCLE ──────────────────────────────────────────
adminRouter.get('/traces', async (req: Request, res: Response): Promise<void> => {
  try {
    const service = req.query.service as string | undefined;
    const status = req.query.status as string | undefined;
    const route = req.query.route as string | undefined;
    const search = req.query.search as string | undefined;
    const minDurationMs = req.query.minDurationMs ? parseInt(req.query.minDurationMs as string) : undefined;
    const startTime = req.query.startTime as string | undefined;
    const endTime = req.query.endTime as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = traceStore.queryTraces({
      service,
      status,
      route,
      search,
      minDurationMs,
      startTime,
      endTime,
      page,
      limit,
    });

    res.json(result);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch traces list');
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

adminRouter.get('/traces/:traceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const traceId = req.params.traceId as string;
    const trace = traceStore.getTrace(traceId);

    if (!trace) {
      // Check if there are related audit events with this traceId
      const relatedAudits = await prisma.auditEvent.findMany({
        where: { traceId },
        orderBy: { timestamp: 'asc' },
      });

      if (relatedAudits.length > 0) {
        res.json({
          traceId,
          rootSpanName: relatedAudits[0].action,
          startTime: new Date(relatedAudits[0].timestamp).getTime(),
          endTime: new Date(relatedAudits[relatedAudits.length - 1].timestamp).getTime(),
          durationMs: 100,
          status: 'OK',
          service: 'api',
          spanCount: relatedAudits.length,
          errorCount: 0,
          spans: relatedAudits.map((a, i) => ({
            traceId,
            spanId: a.spanId || `span_${i}`,
            name: a.action,
            kind: 'INTERNAL',
            service: a.category || 'api',
            startTime: new Date(a.timestamp).getTime(),
            endTime: new Date(a.timestamp).getTime() + 10,
            durationMs: 10,
            status: a.status === 'SUCCESS' ? 'OK' : 'ERROR',
            attributes: a.details ? (typeof a.details === 'object' ? a.details : {}) : {},
            events: [],
          })),
        });
        return;
      }

      res.status(404).json({ error: 'Trace not found or expired from sliding window buffer' });
      return;
    }

    res.json(trace);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch trace detail');
    res.status(500).json({ error: 'Failed to fetch trace details' });
  }
});

// ── 4. ERROR TRACKING (SENTRY-STYLE GROUPING) ─────────────────────────────────
adminRouter.get('/errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const service = req.query.service as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (service && service !== 'all') where.service = service;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, groups] = await Promise.all([
      prisma.errorGroup.count({ where }),
      prisma.errorGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeen: 'desc' },
        include: {
          _count: { select: { occurrences: true } },
        },
      }),
    ]);

    res.json({
      errors: groups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch error groups');
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

adminRouter.get('/errors/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const group = await prisma.errorGroup.findUnique({
      where: { id },
      include: {
        occurrences: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Error group not found' });
      return;
    }

    res.json(group);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch error group details');
    res.status(500).json({ error: 'Failed to fetch error details' });
  }
});

adminRouter.patch('/errors/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    if (!['UNRESOLVED', 'RESOLVED', 'IGNORED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const updated = await prisma.errorGroup.update({
      where: { id },
      data: { status },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: status === 'RESOLVED' ? EventTaxonomy.ADMIN.ERROR_RESOLVED : EventTaxonomy.ADMIN.ERROR_IGNORED,
      targetType: 'error_group',
      targetId: id,
      details: { newStatus: status },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, 'Failed to update error group status');
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ── 5. PERFORMANCE METRICS ────────────────────────────────────────────────────
adminRouter.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = metricsEngine.getSnapshot();
    res.json(snapshot);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch performance metrics');
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ── 6. AUDIT TRAIL (Users & Admin Governance) ──────────────────────────────────
adminRouter.get('/audit/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const category = req.query.category as string | undefined;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const startTime = req.query.startTime as string | undefined;
    const endTime = req.query.endTime as string | undefined;

    const where: any = {};
    if (category && category !== 'all') where.category = category;
    if (action && action !== 'all') where.action = action;
    if (userId) where.actorId = userId;
    if (startTime) where.timestamp = { ...where.timestamp, gte: new Date(startTime) };
    if (endTime) where.timestamp = { ...where.timestamp, lte: new Date(endTime) };

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { actorId: { contains: search, mode: 'insensitive' } },
        { traceId: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    res.json({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch user audit events');
    res.status(500).json({ error: 'Failed to fetch audit events' });
  }
});

adminRouter.get('/audit/users/:userId/timeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const events = await prisma.auditEvent.findMany({
      where: {
        OR: [{ actorId: userId }, { targetUserId: userId }],
      },
      take: 200,
      orderBy: { timestamp: 'desc' },
    });

    res.json({
      user,
      timeline: events,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch user timeline');
    res.status(500).json({ error: 'Failed to fetch user timeline' });
  }
});

adminRouter.get('/audit/admin', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const action = req.query.action as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (action && action !== 'all') where.action = action;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { adminEmail: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, actions] = await Promise.all([
      prisma.adminAction.count({ where }),
      prisma.adminAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    res.json({
      actions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch admin audit actions');
    res.status(500).json({ error: 'Failed to fetch admin actions' });
  }
});

// ── 7. SECURITY INCIDENT LOGS ─────────────────────────────────────────────────
adminRouter.get('/security', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const severity = req.query.severity as string | undefined;
    const eventType = req.query.eventType as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (severity && severity !== 'all') where.severity = severity;
    if (eventType && eventType !== 'all') where.eventType = eventType;
    if (search) {
      where.OR = [
        { eventType: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, events] = await Promise.all([
      prisma.securityEvent.count({ where }),
      prisma.securityEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    res.json({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch security events');
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

adminRouter.patch('/security/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.securityEvent.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.userId,
      },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, 'Failed to resolve security event');
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// ── 8. BACKGROUND JOBS & QUEUES ───────────────────────────────────────────────
adminRouter.get('/jobs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const queuesStatus: Array<{
      name: string;
      counts: { active: number; completed: number; failed: number; delayed: number; waiting: number };
      recentJobs: any[];
    }> = [];

    for (const [name, q] of Object.entries(queueInstances)) {
      try {
        const counts: any = await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
        const jobs = await q.getJobs(['active', 'failed', 'waiting', 'completed'], 0, 20);
        const serializedJobs = jobs.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          opts: j.opts,
          progress: j.progress,
          attemptsMade: j.attemptsMade,
          failedReason: j.failedReason,
          stacktrace: j.stacktrace,
          timestamp: j.timestamp,
          processedOn: j.processedOn,
          finishedOn: j.finishedOn,
        }));

        queuesStatus.push({
          name,
          counts,
          recentJobs: serializedJobs,
        });
      } catch {
        queuesStatus.push({
          name,
          counts: { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 },
          recentJobs: [],
        });
      }
    }

    res.json({ queues: queuesStatus });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch jobs status');
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

adminRouter.post('/jobs/:queueName/:jobId/retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const { queueName, jobId } = req.params;
    const q = queueInstances[queueName as string];
    if (!q) {
      res.status(404).json({ error: 'Queue not found' });
      return;
    }

    const job = await q.getJob(jobId as string);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    await job.retry();
    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: 'JOB.RETRY_TRIGGERED',
      targetType: 'queue_job',
      targetId: `${queueName}/${jobId}`,
    });

    res.json({ success: true, message: `Job ${jobId} queued for retry` });
  } catch (err: any) {
    logger.error({ err }, 'Failed to retry job');
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

// ── 9. SCHEDULER & CRON LOGS ──────────────────────────────────────────────────
adminRouter.get('/scheduler', async (_req: Request, res: Response): Promise<void> => {
  try {
    const repeatableSchedulers: any[] = [];
    for (const [queueName, q] of Object.entries(queueInstances)) {
      try {
        const schedulers = (await q.getJobSchedulers()) as any[];
        for (const s of schedulers) {
          repeatableSchedulers.push({
            queueName,
            key: s.key,
            name: s.name,
            every: s.every,
            cron: s.cron || s.pattern || null,
            next: s.next ? new Date(s.next).toISOString() : null,
          });
        }
      } catch {}
    }

    // Recent scheduler logs from LogStore
    const logs = logStore.query({ category: 'jobs', limit: 50 }).logs;

    res.json({
      schedulers: repeatableSchedulers,
      recentExecutionLogs: logs,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch scheduler info');
    res.status(500).json({ error: 'Failed to fetch scheduler info' });
  }
});

// ── 10. AI OBSERVABILITY & MODEL METRICS ──────────────────────────────────────
adminRouter.get('/ai', async (_req: Request, res: Response): Promise<void> => {
  try {
    const primaryModel = process.env.OPENAI_MODEL || 'minimax/minimax-m3:free';
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'cohere/north-mini-code:free';
    const baseURL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';

    const [reportsWithModel, totalReports, failedReports, totalTimelineSummaries] = await Promise.all([
      prisma.report.groupBy({
        by: ['aiModel'],
        _count: { _all: true },
      }),
      prisma.report.count(),
      prisma.report.count({ where: { status: 'failed' } }),
      prisma.timelineSession.count({ where: { aiSummary: { not: null } } }),
    ]);

    const breakdown = reportsWithModel.map((r) => ({
      model: r.aiModel || primaryModel,
      count: r._count._all,
      percentage: totalReports > 0 ? Math.round((r._count._all / totalReports) * 100) : 0,
    }));

    const successfulReports = totalReports - failedReports;
    const successRate = totalReports > 0 ? Number(((successfulReports / totalReports) * 100).toFixed(1)) : 100;

    // AI specific log events from log store
    const aiLogs = logStore.query({ category: 'ai', limit: 100 }).logs;

    res.json({
      config: {
        primaryModel,
        fallbackModel,
        baseURL,
        providerName: baseURL.includes('openrouter.ai') ? 'OpenRouter API' : baseURL.includes('groq.com') ? 'Groq LPU' : 'OpenAI API',
      },
      metrics: {
        totalReports,
        successfulReports,
        failedReports,
        successRate,
        totalTimelineSummaries,
        estimatedTokensUsed: totalReports * 850 + totalTimelineSummaries * 220,
      },
      modelBreakdown: breakdown.length > 0 ? breakdown : [{ model: primaryModel, count: totalReports, percentage: 100 }],
      recentAiLogs: aiLogs,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch AI observability metrics');
    res.status(500).json({ error: 'Failed to fetch AI metrics' });
  }
});

// ── 11. INTEGRATIONS (GITHUB, GOOGLE, ZOHO) OBSERVABILITY ─────────────────────
adminRouter.get('/integrations/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [githubCount, googleCount, zohoCount, recentEvents] = await Promise.all([
      prisma.githubIntegration.count(),
      prisma.emailConnection.count({ where: { provider: 'google' } }),
      prisma.emailConnection.count({ where: { provider: 'zoho' } }),
      prisma.auditEvent.findMany({
        where: { category: 'integration' },
        take: 50,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    res.json({
      connectedProviders: {
        github: githubCount,
        google: googleCount,
        zoho: zohoCount,
      },
      recentEvents,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch integrations stats');
    res.status(500).json({ error: 'Failed to fetch integrations stats' });
  }
});

// ── 12. EMAIL / NOTIFICATION LOGS ─────────────────────────────────────────────
adminRouter.get('/email/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where: { category: 'email' } }),
      prisma.auditEvent.findMany({
        where: { category: 'email' },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const maskedEvents = events.map((e) => ({
      ...e,
      actorEmail: maskEmail(e.actorEmail),
    }));

    res.json({
      events: maskedEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch email logs');
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// ── 13. SYSTEM HEALTH (DEEP SYSTEM, DB, REDIS) ────────────────────────────────
adminRouter.get('/system-health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const startDb = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    let dbDetails: any = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startDb;
      dbDetails = { connection: 'PostgreSQL Active', latencyMs: dbLatencyMs };
    } catch (err: any) {
      dbStatus = 'down';
      dbDetails = { error: err.message };
    }

    const startRedis = Date.now();
    let redisStatus = 'healthy';
    let redisDetails: any = {};
    try {
      await redisConnection.ping();
      const rawInfo = await redisConnection.info();
      const parsed = parseRedisInfo(rawInfo);
      redisDetails = {
        latencyMs: Date.now() - startRedis,
        totalCommands: parseInt(parsed.total_commands_processed || '0', 10),
        totalKeys: parseInt(parsed.total_keys || '0', 10),
        memory: parsed.total_data_size_human || '0 B',
        opsPerSec: parseInt(parsed.instantaneous_ops_per_sec || '0', 10),
        connectedClients: parseInt(parsed.connected_clients || '0', 10),
      };
    } catch (err: any) {
      redisStatus = 'down';
      redisDetails = { error: err.message };
    }

    const queuesStatus: Record<string, any> = {};
    for (const [name, q] of Object.entries(queueInstances)) {
      try {
        queuesStatus[name] = await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
      } catch {
        queuesStatus[name] = { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 };
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: { status: dbStatus, ...dbDetails },
      redis: { status: redisStatus, ...redisDetails },
      queues: queuesStatus,
      aiProvider: {
        status: 'healthy',
        provider: process.env.OPENAI_BASE_URL || 'OpenRouter / OpenAI',
      },
      emailProvider: {
        status: process.env.RESEND_API_KEY ? 'healthy' : 'unconfigured',
        provider: 'Resend API',
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch deep system health');
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// ── 14. ALERTING CONFIGURATION & INCIDENTS ─────────────────────────────────────
adminRouter.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rules, incidents] = await Promise.all([
      prisma.alertRule.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { incidents: true } } },
      }),
      prisma.alertIncident.findMany({
        take: 50,
        orderBy: { triggeredAt: 'desc' },
        include: { rule: { select: { name: true, severity: true } } },
      }),
    ]);

    res.json({ rules, incidents });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch alerts');
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

adminRouter.post('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, metric, condition, threshold, windowMinutes, severity, recipients } = req.body;
    const rule = await prisma.alertRule.create({
      data: {
        name,
        description,
        metric,
        condition: condition || 'gt',
        threshold: parseFloat(threshold),
        windowMinutes: parseInt(windowMinutes) || 5,
        severity: severity || 'WARNING',
        recipients,
      },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.ALERT_CONFIGURED,
      targetType: 'alert_rule',
      targetId: rule.id,
      details: { name, metric, threshold },
    });

    res.status(201).json(rule);
  } catch (err: any) {
    logger.error({ err }, 'Failed to create alert rule');
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

adminRouter.patch('/alerts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.alertRule.update({
      where: { id },
      data: req.body,
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, 'Failed to update alert rule');
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

adminRouter.delete('/alerts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.alertRule.delete({ where: { id } });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.ALERT_DELETED,
      targetType: 'alert_rule',
      targetId: id,
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete alert rule');
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// ── 15. LOG RETENTION & STORAGE CLEANUP ────────────────────────────────────────
adminRouter.get('/retention', async (_req: Request, res: Response): Promise<void> => {
  try {
    await RetentionService.ensureDefaults();
    const policies = await prisma.retentionPolicy.findMany({
      orderBy: { logCategory: 'asc' },
    });

    const [errorCount, securityCount, auditCount] = await Promise.all([
      prisma.errorOccurrence.count(),
      prisma.securityEvent.count(),
      prisma.auditEvent.count(),
    ]);

    res.json({
      policies,
      storageStats: {
        errorOccurrences: errorCount,
        securityEvents: securityCount,
        auditEvents: auditCount,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch retention policies');
    res.status(500).json({ error: 'Failed to fetch retention policies' });
  }
});

adminRouter.patch('/retention/:category', async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.params.category as string;
    const { retentionDays, archiveEnabled } = req.body;

    const updated = await prisma.retentionPolicy.update({
      where: { logCategory: category },
      data: {
        retentionDays: parseInt(retentionDays),
        archiveEnabled: Boolean(archiveEnabled),
      },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.RETENTION_UPDATED,
      targetType: 'retention_policy',
      targetId: category,
      details: { retentionDays, archiveEnabled },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, 'Failed to update retention policy');
    res.status(500).json({ error: 'Failed to update retention policy' });
  }
});

adminRouter.post('/retention/run-cleanup', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await RetentionService.runCleanup();

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: 'RETENTION.CLEANUP_TRIGGERED',
      details: result,
    });

    res.json({ success: true, result });
  } catch (err: any) {
    logger.error({ err }, 'Failed to run retention cleanup');
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

// ── 16. LOG EXPORT (CSV / JSON) ───────────────────────────────────────────────
adminRouter.post('/logs/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, filters, format } = req.body;
    const jobId = await ExportService.createExportJob({
      userId: req.userId!,
      userEmail: req.userEmail || 'admin@autoeod.com',
      category: category || 'all',
      filters,
      format: format === 'csv' ? 'csv' : 'json',
    });

    res.status(202).json({ success: true, jobId, message: 'Export job queued' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to queue export job');
    res.status(500).json({ error: 'Failed to queue export' });
  }
});

adminRouter.get('/logs/export/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const job = await prisma.logExportJob.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ error: 'Export job not found' });
      return;
    }
    res.json(job);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch export job status');
    res.status(500).json({ error: 'Failed to fetch export status' });
  }
});

adminRouter.get('/logs/export/:id/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const job = await prisma.logExportJob.findUnique({ where: { id } });
    if (!job || job.status !== 'COMPLETED') {
      res.status(404).send('Export not ready or not found');
      return;
    }

    const filePath = ExportService.getExportFilePath(job.id, job.format, job.category);
    if (!filePath) {
      res.status(404).send('Export file no longer available on server');
      return;
    }

    res.setHeader('Content-Type', job.format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="autoeod-export-${job.category}-${job.id}.${job.format}"`);
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).send('Download failed');
  }
});

// ── 17. LOG SETTINGS & SAMPLING CONFIGURATION ─────────────────────────────────
adminRouter.get('/log-settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.observabilitySettings.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
    });
    res.json(settings);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch observability settings');
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

adminRouter.patch('/log-settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { logLevel, samplingRatePercent, aiPromptPrivacy, redactionEnabled } = req.body;
    const updated = await prisma.observabilitySettings.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        logLevel: logLevel || 'info',
        samplingRatePercent: parseFloat(samplingRatePercent) || 100,
        aiPromptPrivacy: aiPromptPrivacy || 'metadata_only',
        redactionEnabled: redactionEnabled ?? true,
      },
      update: {
        logLevel,
        samplingRatePercent: samplingRatePercent !== undefined ? parseFloat(samplingRatePercent) : undefined,
        aiPromptPrivacy,
        redactionEnabled,
      },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.LOG_SETTINGS_UPDATED,
      details: req.body,
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, 'Failed to update observability settings');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── 18. PRESERVED EXISTING ADMIN ROUTES (REMOTE CONFIG, USERS, TEMPLATES, EXTENSION) ───

// Remote Config
const UpdateConfigSchema = z.object({
  apiBaseUrl: z.string().url().optional(),
  webBaseUrl: z.string().url().optional(),
  maintenanceMode: z.boolean().optional(),
  forceUpdate: z.boolean().optional(),
  minExtensionVersion: z.string().optional(),
  minDesktopVersion: z.string().optional(),
});

adminRouter.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOrCreateSystemConfig();
    res.json(config);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch admin system config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/config', async (req: Request, res: Response): Promise<void> => {
  const parse = UpdateConfigSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  try {
    const updated = await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: parse.data,
      create: {
        id: 'global',
        apiBaseUrl: parse.data.apiBaseUrl || 'https://autoeod.onrender.com',
        webBaseUrl: parse.data.webBaseUrl || 'https://autoeod.onrender.com',
        maintenanceMode: parse.data.maintenanceMode ?? false,
        forceUpdate: parse.data.forceUpdate ?? false,
        minExtensionVersion: parse.data.minExtensionVersion || '1.0.0',
        minDesktopVersion: parse.data.minDesktopVersion || '1.0.0',
      },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.CONFIG_UPDATED,
      targetType: 'system_config',
      targetId: 'global',
      details: parse.data,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, 'Failed to update system config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Users Management
const UpdateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

adminRouter.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reports: true,
            activityEvents: true,
            browserLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch users list for admin');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
  const parse = UpdateUserRoleSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const id = req.params.id as string;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { role: parse.data.role },
      select: { id: true, email: true, name: true, role: true },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.USER_ROLE_CHANGED,
      targetType: 'user',
      targetId: id,
      details: { newRole: parse.data.role },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, 'Failed to update user role');
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Email Templates
const TemplateSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  subject: z.string().min(2),
  bodyHtml: z.string().min(2),
  bodyText: z.string().optional(),
  enabled: z.boolean().default(true),
  variables: z.array(z.string()).optional(),
});

adminRouter.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    let templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (templates.length === 0) {
      const defaults = [
        {
          key: 'eod_daily_summary',
          name: 'EOD Daily Summary Report',
          subject: '📊 AutoEOD Report: {{reportDate}} — {{userName}}',
          bodyHtml: `<h2>AutoEOD Daily Activity Report</h2><p>Hello {{userName}},</p><p>Here is your automated end-of-day summary for <strong>{{reportDate}}</strong>:</p><div>{{{summaryHtml}}}</div>`,
          enabled: true,
          variables: JSON.stringify(['userName', 'reportDate', 'summaryHtml']),
        },
        {
          key: 'system_alert',
          name: 'System Maintenance Alert',
          subject: '⚠️ AutoEOD Service Announcement',
          bodyHtml: `<h2>System Update</h2><p>Dear {{userName}},</p><p>{{alertMessage}}</p>`,
          enabled: true,
          variables: JSON.stringify(['userName', 'alertMessage']),
        },
      ];

      for (const d of defaults) {
        await prisma.emailTemplate.create({ data: d });
      }
      templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    }

    res.json(templates);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch email templates');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/templates', async (req: Request, res: Response): Promise<void> => {
  const parse = TemplateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  try {
    const created = await prisma.emailTemplate.create({
      data: {
        key: parse.data.key,
        name: parse.data.name,
        subject: parse.data.subject,
        bodyHtml: parse.data.bodyHtml,
        bodyText: parse.data.bodyText,
        enabled: parse.data.enabled,
        variables: JSON.stringify(parse.data.variables || []),
      },
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.TEMPLATE_CREATED,
      targetType: 'email_template',
      targetId: created.id,
      details: { key: created.key },
    });

    res.status(201).json(created);
  } catch (err: any) {
    logger.error({ err }, 'Failed to create email template');
    res.status(500).json({ error: err.message || 'Failed to create template' });
  }
});

adminRouter.patch('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: req.body,
    });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.TEMPLATE_UPDATED,
      targetType: 'email_template',
      targetId: id,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, 'Failed to update email template');
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

adminRouter.delete('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await prisma.emailTemplate.delete({ where: { id } });

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.TEMPLATE_DELETED,
      targetType: 'email_template',
      targetId: id,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, 'Failed to delete email template');
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Extension Release Builder
adminRouter.post('/release-extension', async (req: Request, res: Response): Promise<void> => {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), 'apps/extension'),
      path.resolve(process.cwd(), '../../apps/extension'),
      path.resolve(process.cwd(), '../extension'),
    ];

    const targetDir = possiblePaths.find((p) => fs.existsSync(p));
    if (!targetDir) {
      res.status(404).json({ error: 'Extension directory not found' });
      return;
    }

    const zip = new AdmZip();
    zip.addLocalFolder(targetDir);
    const zipBuffer = zip.toBuffer();

    const tag = req.body.tag || `v1.0.${Math.floor(Date.now() / 1000)}`;
    const token = req.body.githubToken || process.env.GITHUB_TOKEN;
    const repo = req.body.repo || 'kachakaran6/AutoEOD';

    let releaseUrl: string | null = null;
    let downloadUrl: string | null = null;

    if (token) {
      const createRelRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'AutoEOD-Admin-Release',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_name: tag,
          name: `AutoEOD Chrome Extension ${tag}`,
          body: `Automated Chrome Extension release created via AutoEOD Admin Panel.\nAPI Base URL: ${req.body.apiBaseUrl || 'https://autoeod-be.kachakaran.tech'}`,
          draft: false,
          prerelease: false,
        }),
      });

      if (createRelRes.ok) {
        const relData: any = await createRelRes.json();
        releaseUrl = relData.html_url;
        const uploadUrl = relData.upload_url.replace(/\{.*?\}$/, `?name=autoeod-extension-${tag}.zip`);

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'AutoEOD-Admin-Release',
            'Content-Type': 'application/zip',
          },
          body: zipBuffer,
        });

        if (uploadRes.ok) {
          const assetData: any = await uploadRes.json();
          downloadUrl = assetData.browser_download_url;
        }
      }
    }

    await AuditService.recordAdminAction({
      adminId: req.userId!,
      adminEmail: req.userEmail || 'admin@autoeod.com',
      action: EventTaxonomy.ADMIN.EXTENSION_RELEASE_BUILT,
      targetType: 'extension_release',
      targetId: tag,
      details: { tag, releaseUrl, downloadUrl, sizeBytes: zipBuffer.length },
    });

    res.json({
      success: true,
      tag,
      releaseUrl,
      downloadUrl,
      sizeBytes: zipBuffer.length,
      directDownloadUrl: `/api/admin/download-extension`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to create extension release');
    res.status(500).json({ error: err.message || 'Failed to package extension' });
  }
});

adminRouter.get('/download-extension', async (_req: Request, res: Response): Promise<void> => {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), 'apps/extension'),
      path.resolve(process.cwd(), '../../apps/extension'),
      path.resolve(process.cwd(), '../extension'),
    ];

    const targetDir = possiblePaths.find((p) => fs.existsSync(p));
    if (!targetDir) {
      res.status(404).send('Extension directory not found');
      return;
    }

    const zip = new AdmZip();
    zip.addLocalFolder(targetDir);
    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="autoeod-extension.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).send(err.message || 'Download failed');
  }
});

// Backward compatibility: Legacy audit logs endpoint mapped to AuditEvent
adminRouter.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [total, events] = await Promise.all([
      prisma.auditEvent.count(),
      prisma.auditEvent.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const enrichedLogs = events.map((e) => ({
      id: e.id,
      action: e.action,
      level: e.status === 'SUCCESS' ? 'info' : 'warn',
      details: e.details ? JSON.stringify(e.details) : undefined,
      ipAddress: e.ipAddress,
      createdAt: e.timestamp,
      user: e.actorId ? { id: e.actorId, name: e.actorEmail || 'User', email: e.actorEmail || e.actorId } : null,
    }));

    res.json({
      logs: enrichedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
