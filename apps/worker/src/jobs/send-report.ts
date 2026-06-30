// apps/worker/src/jobs/send-report.ts
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';
import { sendReportEmail } from '../lib/email';

export interface SendReportJobData {
  userId: string;
  reportId: string;
}

export async function sendReportJob(data: SendReportJobData): Promise<void> {
  const { userId, reportId } = data;
  logger.info({ userId, reportId }, 'Processing send-report job');

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { user: true },
  });

  if (!report) {
    logger.warn({ reportId }, 'Report not found for send-report job');
    return;
  }

  // Only send if it's still a draft
  if (report.status !== 'draft') {
    logger.info({ reportId, status: report.status }, 'Report is not in draft status, skipping automatic send');
    return;
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    logger.warn({ userId }, 'User settings not found for send-report job');
    return;
  }

  if (!settings.managerEmail) {
    logger.warn({ userId }, 'No manager email configured, cannot auto-send');
    return;
  }

  const timelineSettings = await prisma.timelineSettings.findUnique({ where: { userId } });
  
  let timelineSessions: any[] = [];
  if (timelineSettings?.enabled) {
    const tz = settings.timezone;
    // Basic day bounds based on reportDate
    const startOfDay = new Date(report.reportDate + 'T00:00:00.000Z');
    const endOfDay = new Date(report.reportDate + 'T23:59:59.999Z');
    
    timelineSessions = await prisma.timelineSession.findMany({
      where: {
        userId,
        startTime: { gte: startOfDay, lte: endOfDay },
        selected: true
      },
      orderBy: { startTime: 'asc' }
    });
  }

  try {
    await sendReportEmail({
      report,
      timelineSessions,
      senderName: report.user.name,
      managerEmail: settings.managerEmail,
      ccEmails: settings.ccEmails || undefined,
      template: settings.reportTemplate,
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'report_sent',
        title: 'Report Sent Automatically',
        message: `Your EOD report for ${report.reportDate} was successfully sent to your manager.`,
        reportId: report.id,
      },
    });

    logger.info({ userId, reportId }, 'Successfully auto-sent report');
  } catch (err) {
    logger.error({ err, userId, reportId }, 'Failed to auto-send report');
    
    const errorMessage = err instanceof Error ? err.message : 'Failed to auto-send email';

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'send_failed',
        errorMessage,
      },
    });

    // Optionally create a failure notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'report_failed',
        title: 'Failed to auto-send report',
        message: `We tried to auto-send your report for ${report.reportDate} but encountered an error: ${errorMessage}. Please send it manually.`,
        reportId: report.id,
      },
    });
  }
}
