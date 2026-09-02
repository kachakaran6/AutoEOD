// apps/api/src/lib/observability/errorTracker.ts
// Sentry-like internal error fingerprinting and grouping tracker

import crypto from 'crypto';
import { prisma } from '@autoeod/db';
import { getObservabilityContext } from './context';
import { redactSensitiveData } from './redaction';

export class ErrorTracker {
  /**
   * Generates a stable fingerprint hash for an error based on name, normalized message, and top stack frame
   */
  public static generateFingerprint(err: Error | any, route?: string): string {
    const errorName = err?.name || 'Error';
    // Normalize message by replacing variable numbers, UUIDs, hex strings
    const rawMessage = (err?.message || String(err))
      .replace(/[a-f0-9]{24,}/gi, '<HEX_ID>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
      .replace(/\d+/g, '<N>');

    // Extract top 2 application stack frames
    const stackLines = (err?.stack || '')
      .split('\n')
      .slice(1, 3)
      .map((line: string) => line.trim().replace(/:\d+:\d+/g, ''))
      .join('|');

    const key = `${errorName}:${rawMessage.slice(0, 150)}:${stackLines}:${route || ''}`;
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
  }

  /**
   * Captures and groups an exception in the database
   */
  public static async captureException(
    err: Error | any,
    options: {
      route?: string;
      method?: string;
      statusCode?: number;
      userId?: string;
      userEmail?: string;
      metadata?: Record<string, any>;
      service?: string;
    } = {}
  ): Promise<string | null> {
    try {
      const ctx = getObservabilityContext();
      const route = options.route || ctx?.route;
      const method = options.method || ctx?.method;
      const userId = options.userId || ctx?.userId;
      const userEmail = options.userEmail || ctx?.userEmail;
      const requestId = ctx?.requestId;
      const traceId = ctx?.traceId;
      const service = options.service || ctx?.service || 'api';
      const environment = ctx?.environment || process.env.NODE_ENV || 'production';

      const errorName = err?.name || 'Error';
      const errorMessage = err?.message || String(err);
      const stackTrace = err?.stack || undefined;
      const fingerprint = this.generateFingerprint(err, route);

      // Upsert Error Group
      const group = await prisma.errorGroup.upsert({
        where: { fingerprint },
        create: {
          fingerprint,
          name: errorName,
          message: errorMessage.slice(0, 1000),
          service,
          environment,
          totalOccurrences: 1,
          affectedUsersCount: userId ? 1 : 0,
          status: 'UNRESOLVED',
          lastTraceId: traceId,
          sampleStackTrace: stackTrace,
        },
        update: {
          lastSeen: new Date(),
          totalOccurrences: { increment: 1 },
          lastTraceId: traceId,
          sampleStackTrace: stackTrace,
        },
      });

      // Record individual occurrence
      await prisma.errorOccurrence.create({
        data: {
          groupId: group.id,
          message: errorMessage.slice(0, 2000),
          stackTrace,
          userId,
          userEmail,
          route,
          method,
          statusCode: options.statusCode || (err?.statusCode as number) || 500,
          requestId,
          traceId,
          metadata: options.metadata ? redactSensitiveData(options.metadata) : undefined,
        },
      });

      return group.id;
    } catch (persistErr) {
      // Fail-safe: logging error tracker failure should never mask the primary application error
      console.error('ErrorTracker capture error (fail-safe):', persistErr);
      return null;
    }
  }
}
