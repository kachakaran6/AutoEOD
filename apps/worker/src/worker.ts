// apps/worker/src/worker.ts
// AutoEOD Worker process entrypoint — Optimized for Upstash Redis Free Tier

import { Worker, Queue } from 'bullmq';
import { redisConnection } from './lib/redis';
import { logger } from './lib/logger';
import { syncGitHubActivity } from './jobs/github-sync';
import { generateReport, type GenerateReportJobData } from './jobs/generate-report';
import { sendReportJob, type SendReportJobData } from './jobs/send-report';
import { scheduleDispatcher } from './jobs/schedule-dispatcher';
import { prisma } from '@autoeod/db';

logger.info('AutoEOD Worker process starting...');

// ── Queues ────────────────────────────────────────────────────────────────────
const githubSyncQueue = new Queue('github-sync', { connection: redisConnection as any });
const scheduleDispatcherQueue = new Queue('schedule-dispatcher', { connection: redisConnection as any });
const generateReportQueue = new Queue('generate-report', { connection: redisConnection as any });

// ── Upstash Optimization Worker Options ────────────────────────────────────────
// Reduces Redis polling command frequency by 90%+ to stay well within Upstash 500k/mo free tier
const UPSTASH_WORKER_OPTS = {
  connection: redisConnection as any,
  drainDelay: 300,         // Wait 5 minutes before re-checking an empty queue
  stalledInterval: 0,      // Disable continuous stalled job scanning (cuts 99% of idle Redis ops)
  lockDuration: 120000,    // 2 minute job lock
};

// ── Register repeatable jobs ──────────────────────────────────────────────────
async function registerRepeatableJobs(): Promise<void> {
  // GitHub sync: every 1 hour for ALL users (reduces Upstash read/write ops)
  await githubSyncQueue.upsertJobScheduler('github-sync-all-users', { every: 60 * 60 * 1000 }, {
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

  logger.info('Repeatable jobs registered (Upstash optimized)');
}

// ── GitHub Sync Worker ────────────────────────────────────────────────────────
const githubSyncWorker = new Worker(
  'github-sync',
  async (job) => {
    if (job.data.allUsers) {
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
      await syncGitHubActivity(job.data.userId);
    }
  },
  { ...UPSTASH_WORKER_OPTS, concurrency: 2 }
);

// ── Schedule Dispatcher Worker ────────────────────────────────────────────────
const scheduleDispatcherWorker = new Worker(
  'schedule-dispatcher',
  async () => {
    await scheduleDispatcher();
  },
  { ...UPSTASH_WORKER_OPTS, concurrency: 1 }
);

// ── Generate Report Worker ─────────────────────────────────────────────────────
const generateReportWorker = new Worker(
  'generate-report',
  async (job) => {
    const data = job.data as GenerateReportJobData;
    logger.info({ jobId: job.id, userId: data.userId, reportDate: data.reportDate }, 'Processing generate-report job');
    await generateReport(data);
  },
  { ...UPSTASH_WORKER_OPTS, concurrency: 3 }
);

// ── Send Report Worker ─────────────────────────────────────────────────────────
const sendReportWorker = new Worker(
  'send-report',
  async (job) => {
    const data = job.data as SendReportJobData;
    await sendReportJob(data);
  },
  { ...UPSTASH_WORKER_OPTS, concurrency: 5 }
);

// ── Event handlers ────────────────────────────────────────────────────────────
for (const worker of [githubSyncWorker, scheduleDispatcherWorker, generateReportWorker, sendReportWorker]) {
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: job.queueName }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed');
  });
}

// ── Process lifecycle ─────────────────────────────────────────────────────────
async function main() {
  await registerRepeatableJobs();
  logger.info('AutoEOD Worker ready');
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down gracefully...');
  await Promise.all([
    githubSyncWorker.close(),
    scheduleDispatcherWorker.close(),
    generateReportWorker.close(),
    sendReportWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
