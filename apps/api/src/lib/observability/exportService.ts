// apps/api/src/lib/observability/exportService.ts
// Asynchronous background log & audit export generator

import fs from 'fs';
import path from 'path';
import { prisma } from '@autoeod/db';
import { logStore } from './logStore';
import { AuditService } from './auditService';
import { EventTaxonomy } from './events';

export class ExportService {
  private static exportDir = path.resolve(process.cwd(), 'exports');

  private static ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Triggers an asynchronous export job
   */
  public static async createExportJob(params: {
    userId: string;
    userEmail: string;
    category: string;
    filters?: Record<string, any>;
    format?: 'json' | 'csv';
  }): Promise<string> {
    this.ensureExportDir();

    const format = params.format || 'json';

    const job = await prisma.logExportJob.create({
      data: {
        requestedByUserId: params.userId,
        requestedByUserEmail: params.userEmail,
        category: params.category,
        filters: params.filters || {},
        format,
        status: 'PROCESSING',
      },
    });

    // Audit the export action
    await AuditService.recordAdminAction({
      adminId: params.userId,
      adminEmail: params.userEmail,
      action: EventTaxonomy.ADMIN.EXPORT_REQUESTED,
      targetType: 'export_job',
      targetId: job.id,
      details: { category: params.category, format, filters: params.filters },
    });

    // Process asynchronously without blocking HTTP request
    setImmediate(async () => {
      try {
        let records: any[] = [];

        if (params.category === 'audit_events') {
          records = await prisma.auditEvent.findMany({
            take: 10000,
            orderBy: { timestamp: 'desc' },
          });
        } else if (params.category === 'admin_actions') {
          records = await prisma.adminAction.findMany({
            take: 10000,
            orderBy: { timestamp: 'desc' },
          });
        } else if (params.category === 'security_events') {
          records = await prisma.securityEvent.findMany({
            take: 10000,
            orderBy: { timestamp: 'desc' },
          });
        } else {
          // Application logs from log store
          const queryRes = logStore.query({
            category: params.category === 'all' ? undefined : params.category,
            limit: 5000,
          });
          records = queryRes.logs;
        }

        let fileContent = '';
        const fileName = `export-${params.category}-${job.id}.${format}`;
        const filePath = path.join(this.exportDir, fileName);

        if (format === 'csv') {
          if (records.length > 0) {
            const headers = Object.keys(records[0]).filter((k) => typeof records[0][k] !== 'object');
            const rows = records.map((r) =>
              headers
                .map((h) => {
                  const val = String(r[h] ?? '').replace(/"/g, '""');
                  return `"${val}"`;
                })
                .join(',')
            );
            fileContent = [headers.join(','), ...rows].join('\n');
          } else {
            fileContent = 'No records found';
          }
        } else {
          fileContent = JSON.stringify(records, null, 2);
        }

        fs.writeFileSync(filePath, fileContent, 'utf-8');

        await prisma.logExportJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            rowCount: records.length,
            fileSizeBytes: Buffer.byteLength(fileContent),
            downloadUrl: `/api/admin/logs/export/${job.id}/download`,
            completedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Available for 24h
          },
        });
      } catch (err: any) {
        console.error('ExportService error (fail-safe):', err);
        await prisma.logExportJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: err?.message || 'Export processing failed',
            completedAt: new Date(),
          },
        }).catch(() => {});
      }
    });

    return job.id;
  }

  public static getExportFilePath(jobId: string, format: string, category: string): string | null {
    const fileName = `export-${category}-${jobId}.${format}`;
    const filePath = path.join(this.exportDir, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }
}
