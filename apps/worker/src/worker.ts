// apps/worker/src/worker.ts
// AutoEOD Worker process — runs BullMQ workers and repeatable jobs
// This is a SEPARATE process from the API server (start with: tsx src/worker.ts)

import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { redisConnection } from './lib/redis';
import { logger } from './lib/logger';
import { syncGitHubActivity } from './jobs/github-sync';
import { generateReport, type GenerateReportJobData } from './jobs/generate-report';
import { scheduleDispatcher } from './jobs/schedule-dispatcher';
import { prisma } from '@autoeod/db';

logger.info('AutoEOD Worker starting...');

// ── Queue references (for registering repeatable jobs) ────────────────────────
const githubSyncQueue = new Queue('github-sync', { connection: redisConnection as any });
const scheduleDispatcherQueue = new Queue('schedule-dispatcher', { connection: redisConnection as any });
const generateReportQueue = new Queue('generate-report', { connection: redisConnection as any });

// ── Register repeatable jobs ──────────────────────────────────────────────────
async function registerRepeatableJobs(): Promise<void> {
  // GitHub sync: every 15 minutes for ALL users
  await githubSyncQueue.upsertJobScheduler('github-sync-all-users', { every: 15 * 60 * 1000 }, {
    name: 'github-sync-all',
    data: { allUsers: true },
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  });

  // Schedule dispatcher: every 5 minutes
  await scheduleDispatcherQueue.upsertJobScheduler('schedule-dispatcher', { every: 5 * 60 * 1000 }, {
    name: 'dispatch',
    data: {},
    opts: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
  });

  logger.info('Repeatable jobs registered');
}

// ── GitHub Sync Worker ────────────────────────────────────────────────────────
const githubSyncWorker = new Worker(
  'github-sync',
  async (job) => {
    if (job.data.allUsers) {
      // Sync all users with GitHub integrations
      const integrations = await prisma.githubIntegration.findMany({
        where: { needsReconnect: false },
        select: { userId: true },
      });
      logger.info({ count: integrations.length }, 'Starting GitHub sync for all users');
      for (const { userId } of integrations) {
        try {
          await syncGitHubActivity(userId);
        } catch (err) {
          logger.error({ err, userId }, 'GitHub sync failed for user (continuing with others)');
        }
      }
    } else if (job.data.userId) {
      // Single-user sync (triggered on connect or manual)
      await syncGitHubActivity(job.data.userId);
    }
  },
  { connection: redisConnection as any, concurrency: 2 }
);

// ── Schedule Dispatcher Worker ────────────────────────────────────────────────
const scheduleDispatcherWorker = new Worker(
  'schedule-dispatcher',
  async () => {
    await scheduleDispatcher();
  },
  { connection: redisConnection as any, concurrency: 1 }
);

// ── Generate Report Worker ─────────────────────────────────────────────────────
const generateReportWorker = new Worker(
  'generate-report',
  async (job) => {
    const data = job.data as GenerateReportJobData;
    logger.info({ jobId: job.id, userId: data.userId, reportDate: data.reportDate }, 'Processing generate-report job');
    await generateReport(data);
  },
  { connection: redisConnection as any, concurrency: 3 }
);

// ── Event handlers ────────────────────────────────────────────────────────────
for (const worker of [githubSyncWorker, scheduleDispatcherWorker, generateReportWorker]) {
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: job.queueName }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: job?.queueName, err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });
}

// ── Startup ───────────────────────────────────────────────────────────────────
registerRepeatableJobs()
  .then(() => logger.info('AutoEOD Worker ready'))
  .catch((err) => {
    logger.error({ err }, 'Failed to register repeatable jobs');
    process.exit(1);
  });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down worker...');
  await Promise.all([
    githubSyncWorker.close(),
    scheduleDispatcherWorker.close(),
    generateReportWorker.close(),
  ]);
  await prisma.$disconnect();
  logger.info('Worker shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
