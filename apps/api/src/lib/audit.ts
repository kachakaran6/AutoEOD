// apps/api/src/lib/audit.ts
// Bridge for recording system audit events via centralized AuditService

import { AuditService } from './observability/auditService';
import { logger } from './observability';

export async function recordAuditLog(params: {
  action: string;
  userId?: string;
  level?: 'info' | 'warn' | 'error';
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  logger.info({ action: params.action, userId: params.userId, details: params.details }, `[AuditLog] ${params.action}`);

  await AuditService.recordEvent({
    action: params.action,
    actorId: params.userId,
    status: params.level === 'error' ? 'FAILURE' : 'SUCCESS',
    details: params.details,
    ipAddress: params.ipAddress,
  });
}
