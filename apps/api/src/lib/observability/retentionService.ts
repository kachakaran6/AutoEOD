// apps/api/src/lib/observability/retentionService.ts
// Configurable data retention manager & cleanup runner

import { prisma } from '@autoeod/db';

export const DEFAULT_RETENTION_POLICIES = [
  { id: 'app_logs', logCategory: 'app_logs', retentionDays: 7, archiveEnabled: false },
  { id: 'api_logs', logCategory: 'api_logs', retentionDays: 14, archiveEnabled: false },
  { id: 'error_logs', logCategory: 'error_logs', retentionDays: 30, archiveEnabled: false },
  { id: 'security_logs', logCategory: 'security_logs', retentionDays: 90, archiveEnabled: false },
  { id: 'audit_logs', logCategory: 'audit_logs', retentionDays: 365, archiveEnabled: true },
];

export class RetentionService {
  /**
   * Initializes default retention policies in DB if missing
   */
  public static async ensureDefaults(): Promise<void> {
    try {
      for (const policy of DEFAULT_RETENTION_POLICIES) {
        await prisma.retentionPolicy.upsert({
          where: { logCategory: policy.logCategory },
          create: policy,
          update: {},
        });
      }
    } catch (err) {
      console.error('RetentionService ensureDefaults error (fail-safe):', err);
    }
  }

  /**
   * Executes database cleanup for expired records based on configured retention policies
   */
  public static async runCleanup(): Promise<{
    cleanedErrorOccurrences: number;
    cleanedSecurityEvents: number;
    cleanedExportJobs: number;
    cleanedAuditEvents: number;
  }> {
    await this.ensureDefaults();

    const policies = await prisma.retentionPolicy.findMany();
    const policyMap = new Map(policies.map((p) => [p.logCategory, p.retentionDays]));

    const result = {
      cleanedErrorOccurrences: 0,
      cleanedSecurityEvents: 0,
      cleanedExportJobs: 0,
      cleanedAuditEvents: 0,
    };

    try {
      // 1. Clean Error Occurrences
      const errorDays = policyMap.get('error_logs') || 30;
      const errorCutoff = new Date(Date.now() - errorDays * 24 * 60 * 60 * 1000);
      const errorsDeleted = await prisma.errorOccurrence.deleteMany({
        where: { timestamp: { lt: errorCutoff } },
      });
      result.cleanedErrorOccurrences = errorsDeleted.count;

      // 2. Clean Security Events
      const securityDays = policyMap.get('security_logs') || 90;
      const securityCutoff = new Date(Date.now() - securityDays * 24 * 60 * 60 * 1000);
      const securityDeleted = await prisma.securityEvent.deleteMany({
        where: { timestamp: { lt: securityCutoff }, resolved: true },
      });
      result.cleanedSecurityEvents = securityDeleted.count;

      // 3. Clean Expired Export Jobs
      const exportCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const exportsDeleted = await prisma.logExportJob.deleteMany({
        where: { createdAt: { lt: exportCutoff } },
      });
      result.cleanedExportJobs = exportsDeleted.count;

      // 4. Clean Audit Events if explicitly past retention threshold
      const auditDays = policyMap.get('audit_logs') || 365;
      if (auditDays < 3650) { // Safety check: at least keep 1 year
        const auditCutoff = new Date(Date.now() - auditDays * 24 * 60 * 60 * 1000);
        const auditDeleted = await prisma.auditEvent.deleteMany({
          where: { timestamp: { lt: auditCutoff } },
        });
        result.cleanedAuditEvents = auditDeleted.count;
      }
    } catch (err) {
      console.error('RetentionService runCleanup error (fail-safe):', err);
    }

    return result;
  }
}
