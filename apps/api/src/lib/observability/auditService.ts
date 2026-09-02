// apps/api/src/lib/observability/auditService.ts
// Relational, append-only, tamper-resistant audit trail service

import { prisma } from '@autoeod/db';
import { getObservabilityContext } from './context';
import { redactSensitiveData } from './redaction';

export interface RecordAuditParams {
  action: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  targetUserId?: string;
  category?: 'auth' | 'user' | 'report' | 'integration' | 'ai' | 'email' | 'system';
  resource?: string;
  resourceId?: string;
  status?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason?: string;
  details?: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordAdminActionParams {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Records a user/business accountability audit event in PostgreSQL
   */
  public static async recordEvent(params: RecordAuditParams): Promise<void> {
    try {
      const ctx = getObservabilityContext();
      const actorId = params.actorId || ctx?.userId;
      const actorEmail = params.actorEmail || ctx?.userEmail;
      const actorRole = params.actorRole || ctx?.userRole || 'USER';
      const ipAddress = params.ipAddress || ctx?.ipAddress;
      const userAgent = params.userAgent || ctx?.userAgent;
      const requestId = ctx?.requestId;
      const traceId = ctx?.traceId;
      const spanId = ctx?.spanId;

      // Infer category from action prefix if omitted (e.g. AUTH.LOGIN -> auth)
      let category = params.category;
      if (!category) {
        const prefix = params.action.split('.')[0].toLowerCase();
        if (['auth', 'user', 'report', 'github', 'ai', 'email', 'system'].includes(prefix)) {
          category = (prefix === 'github' ? 'integration' : prefix) as any;
        } else {
          category = 'user';
        }
      }

      const sanitizedDetails = params.details ? redactSensitiveData(params.details) : undefined;
      const sanitizedBefore = params.beforeState ? redactSensitiveData(params.beforeState) : undefined;
      const sanitizedAfter = params.afterState ? redactSensitiveData(params.afterState) : undefined;

      await prisma.auditEvent.create({
        data: {
          action: params.action,
          actorId,
          actorEmail,
          actorRole,
          targetUserId: params.targetUserId || actorId,
          category,
          resource: params.resource,
          resourceId: params.resourceId,
          status: params.status || 'SUCCESS',
          reason: params.reason,
          details: sanitizedDetails,
          beforeState: sanitizedBefore,
          afterState: sanitizedAfter,
          ipAddress,
          userAgent,
          requestId,
          traceId,
          spanId,
        },
      });

      // Backward compatibility dual-write to legacy AuditLog table
      await prisma.auditLog.create({
        data: {
          action: params.action,
          userId: actorId,
          level: params.status === 'FAILURE' || params.status === 'DENIED' ? 'warn' : 'info',
          details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : undefined,
          ipAddress,
        },
      }).catch(() => {});
    } catch (err) {
      console.error('AuditService recordEvent error (fail-safe):', err);
    }
  }

  /**
   * Records a high-privilege administrative action
   */
  public static async recordAdminAction(params: RecordAdminActionParams): Promise<void> {
    try {
      const ctx = getObservabilityContext();
      const ipAddress = params.ipAddress || ctx?.ipAddress;
      const userAgent = params.userAgent || ctx?.userAgent;
      const requestId = ctx?.requestId;
      const traceId = ctx?.traceId;

      await prisma.adminAction.create({
        data: {
          adminId: params.adminId,
          adminEmail: params.adminEmail,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          before: params.before ? redactSensitiveData(params.before) : undefined,
          after: params.after ? redactSensitiveData(params.after) : undefined,
          reason: params.reason,
          details: params.details ? redactSensitiveData(params.details) : undefined,
          ipAddress,
          userAgent,
          requestId,
          traceId,
        },
      });
    } catch (err) {
      console.error('AuditService recordAdminAction error (fail-safe):', err);
    }
  }
}
