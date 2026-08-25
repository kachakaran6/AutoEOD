// apps/worker/src/lib/audit.ts
// Helper to record background worker audit events in PostgreSQL and Pino logger

import { prisma } from '@autoeod/db';
import { logger } from './logger';

export async function recordAuditLog(params: {
  action: string;
  userId?: string;
  level?: 'info' | 'warn' | 'error';
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  const level = params.level || 'info';
  const detailsStr = params.details ? JSON.stringify(params.details) : undefined;

  logger.info({ action: params.action, userId: params.userId, details: params.details }, `[AuditLog] ${params.action}`);

  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        level,
        details: detailsStr,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to persist audit log to database');
  }
}
