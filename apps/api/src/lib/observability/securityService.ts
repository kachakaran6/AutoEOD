// apps/api/src/lib/observability/securityService.ts
// Security event logging, brute-force detection, and threat monitoring

import { prisma } from '@autoeod/db';
import { getObservabilityContext } from './context';
import { redactSensitiveData } from './redaction';

export interface RecordSecurityEventParams {
  eventType: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

export class SecurityService {
  /**
   * Records a security incident in PostgreSQL
   */
  public static async recordEvent(params: RecordSecurityEventParams): Promise<void> {
    try {
      const ctx = getObservabilityContext();
      const userId = params.userId || ctx?.userId;
      const userEmail = params.userEmail || ctx?.userEmail;
      const ipAddress = params.ipAddress || ctx?.ipAddress;
      const userAgent = params.userAgent || ctx?.userAgent;
      const route = params.route || ctx?.route;
      const method = params.method || ctx?.method;
      const requestId = ctx?.requestId;
      const traceId = ctx?.traceId;

      await prisma.securityEvent.create({
        data: {
          eventType: params.eventType,
          severity: params.severity || 'LOW',
          userId,
          userEmail,
          ipAddress,
          userAgent,
          route,
          method,
          statusCode: params.statusCode,
          requestId,
          traceId,
          details: params.details ? redactSensitiveData(params.details) : undefined,
        },
      });
    } catch (err) {
      console.error('SecurityService recordEvent error (fail-safe):', err);
    }
  }

  /**
   * Checks for brute force patterns against an IP / email in the last 15 minutes
   */
  public static async checkAndFlagBruteForce(ipAddress?: string, userEmail?: string): Promise<boolean> {
    if (!ipAddress && !userEmail) return false;

    try {
      const windowStart = new Date(Date.now() - 15 * 60 * 1000);
      const failedCount = await prisma.securityEvent.count({
        where: {
          eventType: 'AUTH.LOGIN_FAILED',
          timestamp: { gte: windowStart },
          OR: [
            ipAddress ? { ipAddress } : {},
            userEmail ? { userEmail } : {},
          ],
        },
      });

      if (failedCount >= 5) {
        await this.recordEvent({
          eventType: 'SECURITY.BRUTE_FORCE_SUSPECTED',
          severity: failedCount >= 10 ? 'CRITICAL' : 'HIGH',
          ipAddress,
          userEmail,
          details: { failedAttemptsIn15m: failedCount },
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
