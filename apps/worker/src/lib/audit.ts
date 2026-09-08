// apps/worker/src/lib/audit.ts
import { WorkerAuditService } from './observability/auditService';
import { logger } from './logger';

export async function recordAuditLog(params: {
  action: string;
  userId?: string;
  category?: 'auth' | 'user' | 'report' | 'integration' | 'ai' | 'email' | 'system';
  level?: 'info' | 'warn' | 'error';
  details?: Record<string, any>;
}) {
  logger.info({ action: params.action, userId: params.userId, details: params.details }, `[WorkerAudit] ${params.action}`);

  await WorkerAuditService.recordEvent({
    action: params.action,
    actorId: params.userId,
    category: params.category,
    status: params.level === 'error' ? 'FAILURE' : 'SUCCESS',
    details: params.details,
  });
}
