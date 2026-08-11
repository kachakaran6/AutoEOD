// apps/api/src/routes/admin.ts
// Protected Admin Endpoints (/api/admin/*)

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getOrCreateSystemConfig } from './config';
import { logger } from '../lib/logger';
import { redisConnection } from '../lib/redis';
import { Queue } from 'bullmq';

export const adminRouter = Router();

// Apply auth + admin guard to all /api/admin routes
adminRouter.use(requireAuth, requireAdmin);

// ── Admin Config Schemas ──────────────────────────────────────────────────────
const UpdateConfigSchema = z.object({
  apiBaseUrl: z.string().url().optional(),
  webBaseUrl: z.string().url().optional(),
  maintenanceMode: z.boolean().optional(),
  forceUpdate: z.boolean().optional(),
  minExtensionVersion: z.string().optional(),
  minDesktopVersion: z.string().optional(),
});

const UpdateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

// Helper to parse Redis info string
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

// ── GET /api/admin/config ─────────────────────────────────────────────────────
adminRouter.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOrCreateSystemConfig();
    res.json(config);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch admin system config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/config ────────────────────────────────────────────────────
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
    logger.info({ userId: req.userId, updated }, 'Admin updated SystemConfig');
    res.json(updated);
  } catch (err) {
    logger.error({ err }, 'Failed to update system config');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────
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

// ── PATCH /api/admin/users/:id/role ───────────────────────────────────────────
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
    logger.info({ adminId: req.userId, targetUserId: id, newRole: parse.data.role }, 'Admin updated user role');
    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, 'Failed to update user role');
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// ── GET /api/admin/health ──────────────────────────────────────────────────────
adminRouter.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const healthStatus: Record<string, any> = {
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    database: { status: 'down' },
    redis: { status: 'down' },
    queues: {},
  };

  // 1. PostgreSQL Database Ping
  try {
    const startDb = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.database = {
      status: 'healthy',
      latencyMs: Date.now() - startDb,
    };
  } catch (err: any) {
    healthStatus.database = { status: 'unhealthy', error: err.message };
  }

  // 2. Upstash Redis Stats & Ping
  try {
    const startRedis = Date.now();
    await redisConnection.ping();
    const infoRaw = await redisConnection.info();
    const parsed = parseRedisInfo(infoRaw);

    healthStatus.redis = {
      status: 'healthy',
      latencyMs: Date.now() - startRedis,
      totalCommands: parseInt(parsed.total_commands_processed || '0', 10),
      totalReads: parseInt(parsed.total_reads_processed || '0', 10),
      totalWrites: parseInt(parsed.total_writes_processed || '0', 10),
      totalKeys: parseInt(parsed.total_keys || '0', 10),
      dataSize: parsed.total_data_size_human || '0 B',
      opsPerSec: parseInt(parsed.instantaneous_ops_per_sec || '0', 10),
      connectedClients: parseInt(parsed.connected_clients || '0', 10),
    };

    // Inspect BullMQ queues
    const queueNames = ['github-sync', 'schedule-dispatcher', 'generate-report', 'send-report'];
    for (const name of queueNames) {
      const q = new Queue(name, { connection: redisConnection as any });
      const counts = await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
      healthStatus.queues[name] = counts;
    }
  } catch (err: any) {
    healthStatus.redis = { status: 'unhealthy', error: err.message };
  }

  res.json(healthStatus);
});
