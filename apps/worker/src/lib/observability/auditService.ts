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
      let resolvedCategory = params.category;
      if (!resolvedCategory) {
        const a = params.action.toUpperCase();
        if (a.includes('GITHUB') || a.includes('SYNC') || a.includes('INTEGRATION') || a.includes('OAUTH')) {
          resolvedCategory = 'integration';
        } else if (a.includes('EMAIL') || a.includes('SEND_REPORT') || a.includes('REMINDER')) {
          resolvedCategory = 'email';
        } else if (a.includes('AI_') || a.includes('MODEL') || a.includes('FALLBACK')) {
          resolvedCategory = 'ai';
        } else if (a.includes('REPORT')) {
          resolvedCategory = 'report';
        } else if (a.includes('AUTH') || a.includes('LOGIN')) {
          resolvedCategory = 'auth';
        } else {
          resolvedCategory = 'system';
        }
      }

      await prisma.auditEvent.create({
        data: {
          action: params.action,
          actorId: params.actorId,
          category: resolvedCategory,
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
