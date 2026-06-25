// apps/worker/src/jobs/schedule-dispatcher.ts
// Runs every 5 minutes. Checks all users with autoGenerate=true
// and enqueues generate-report jobs for users whose reportTime matches now (in their timezone).

import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';
import { redisConnection } from '../lib/redis';

const generateReportQueue = new Queue('generate-report', { connection: redisConnection as any });

export async function scheduleDispatcher(): Promise<void> {
  logger.debug('Schedule dispatcher running');

  const usersWithSettings = await prisma.userSettings.findMany({
    where: { autoGenerate: true },
    select: { userId: true, timezone: true, reportTime: true },
  });

  let dispatched = 0;

  for (const userSetting of usersWithSettings) {
    const { userId, timezone, reportTime } = userSetting;

    // What time is it now for this user?
    const nowInTz = DateTime.now().setZone(timezone);
    const nowHHMM = nowInTz.toFormat('HH:mm');
    const reportDate = nowInTz.toISODate()!;

    // Check if current time matches the report time (within a 5-minute window)
    // Parse times to compare
    const [rH, rM] = reportTime.split(':').map(Number);
    const [nH, nM] = nowHHMM.split(':').map(Number);
    // We want generation to start 5 minutes BEFORE reportTime.
    const reportMinutes = rH * 60 + rM;
    const targetGenerationMinutes = (reportMinutes - 5 + 1440) % 1440;
    
    const nowMinutes = nH * 60 + nM;

    // Match if within the 5-minute window [targetGenerationMinutes, targetGenerationMinutes+5)
    // Use modulo difference to handle wraparound (e.g., target 23:58, now 00:02)
    const diff = (nowMinutes - targetGenerationMinutes + 1440) % 1440;
    if (diff >= 5) continue;

    // Check if a report already exists for today (to avoid double-triggering)
    const existing = await prisma.report.findUnique({
      where: { userId_reportDate: { userId, reportDate } },
      select: { id: true, status: true },
    });

    // Skip if a non-failed report already exists
    if (existing && existing.status !== 'failed') {
      logger.debug({ userId, reportDate, status: existing.status }, 'Report already exists, skipping');
      continue;
    }

    // Enqueue generation
    const jobId = `scheduled-${userId}-${reportDate}-${reportTime.replace(':', '')}`;
    await generateReportQueue.add(
      'generate-report',
      { userId, reportDate, manual: false },
      {
        jobId, // idempotent job ID prevents re-enqueuing if already in queue
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
      }
    );

    logger.info({ userId, reportDate, timezone }, 'Enqueued scheduled report generation');
    dispatched++;
  }

  if (dispatched > 0) {
    logger.info({ dispatched }, 'Schedule dispatcher: dispatched jobs');
  }
}
