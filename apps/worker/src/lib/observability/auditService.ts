// apps/worker/src/lib/observability/auditService.ts
import { prisma } from '@autoeod/db';
import { redactSensitiveData } from './redaction';

export class WorkerAuditService {
  public static async recordEvent(params: {
    action: string;
    actorId?: string;
    category?: 'auth' | 'user' | 'report' | 'integration' | 'ai' | 'email' | 'system';
    resource?: string;
    resourceId?: string;
    status?: 'SUCCESS' | 'FAILURE';
    reason?: string;
    details?: Record<string, any>;
    traceId?: string;
    spanId?: string;
    requestId?: string;
  }): Promise<void> {
    try {
      const sanitized = params.details ? redactSensitiveData(params.details) : undefined;
      await prisma.auditEvent.create({
        data: {
          action: params.action,
          actorId: params.actorId,
          category: params.category || 'system',
          resource: params.resource,
          resourceId: params.resourceId,
          status: params.status || 'SUCCESS',
          reason: params.reason,
          details: sanitized,
          traceId: params.traceId,
          spanId: params.spanId,
          requestId: params.requestId,
        },
      });

      // Backward compatibility dual-write to legacy AuditLog
      await prisma.auditLog.create({
        data: {
          action: params.action,
          userId: params.actorId,
          level: params.status === 'FAILURE' ? 'warn' : 'info',
          details: sanitized ? JSON.stringify(sanitized) : undefined,
        },
      }).catch(() => {});
    } catch (err) {
      console.error('WorkerAuditService error (fail-safe):', err);
    }
  }
}
