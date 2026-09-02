// apps/worker/src/lib/audit.ts
import { WorkerAuditService } from './observability/auditService';
import { logger } from './logger';

export async function recordAuditLog(params: {
  action: string;
  userId?: string;
  level?: 'info' | 'warn' | 'error';
  details?: Record<string, any>;
}) {
  logger.info({ action: params.action, userId: params.userId, details: params.details }, `[WorkerAudit] ${params.action}`);

  await WorkerAuditService.recordEvent({
    action: params.action,
    actorId: params.userId,
    status: params.level === 'error' ? 'FAILURE' : 'SUCCESS',
    details: params.details,
  });
}
