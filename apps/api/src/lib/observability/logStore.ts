// apps/api/src/lib/observability/logStore.ts
// In-Memory Ring Buffer & Fast Queryable Log Store (Prevents DB bloat)

import os from 'os';
import fs from 'fs';
import path from 'path';

export interface StructuredLog {
  id: string;
  timestamp: string; // ISO string
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  environment: string;
  application: string;
  hostname: string;
  processId: number;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  userEmail?: string;
  action?: string;
  event?: string;
  message: string;
  durationMs?: number;
  status?: string | number;
  category?: 'app' | 'api' | 'security' | 'jobs' | 'ai' | 'integrations' | 'email' | 'system';
  metadata?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
}

export interface LogQueryParams {
  level?: string;
  service?: string;
  category?: string;
  traceId?: string;
  requestId?: string;
  userId?: string;
  action?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

export interface LogQueryResult {
  logs: StructuredLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  levelCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

class LogStore {
  private buffer: StructuredLog[] = [];
  private maxCapacity = 10000;
  private logDir = path.resolve(process.cwd(), 'logs');
  private currentLogDate = '';
  private fileWriteStream: fs.WriteStream | null = null;

  constructor() {
    this.ensureLogDir();
  }

  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      // Fail-safe: continue without filesystem logs if readonly fs
    }
  }

  private getFileStream(): fs.WriteStream | null {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (this.currentLogDate !== today || !this.fileWriteStream) {
        if (this.fileWriteStream) {
          this.fileWriteStream.end();
        }
        this.currentLogDate = today;
        const filePath = path.join(this.logDir, `autoeod-${today}.log`);
        this.fileWriteStream = fs.createWriteStream(filePath, { flags: 'a' });
      }
      return this.fileWriteStream;
    } catch {
      return null;
    }
  }

  public push(log: StructuredLog): void {
    try {
      if (this.buffer.length >= this.maxCapacity) {
        this.buffer.shift(); // Evict oldest log in ring buffer
      }
      this.buffer.push(log);

      // Asynchronously append to daily log file
      const stream = this.getFileStream();
      if (stream) {
        stream.write(JSON.stringify(log) + '\n');
      }
    } catch (err) {
      // Fail-safe: never crash application on log store write
      console.error('LogStore push error (fail-safe bypassed):', err);
    }
  }

  public query(params: LogQueryParams): LogQueryResult {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(params.limit || 50, 500);
    const search = params.search?.toLowerCase().trim();
    const startTimeMs = params.startTime ? new Date(params.startTime).getTime() : 0;
    const endTimeMs = params.endTime ? new Date(params.endTime).getTime() : Infinity;

    const levelCounts: Record<string, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    const categoryCounts: Record<string, number> = {
      app: 0,
      api: 0,
      security: 0,
      jobs: 0,
      ai: 0,
      integrations: 0,
      email: 0,
      system: 0,
    };

    // Filter buffer (reversed so latest logs are first)
    const matched: StructuredLog[] = [];

    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const item = this.buffer[i];
      const itemTime = new Date(item.timestamp).getTime();

      // Aggregate counts
      if (levelCounts[item.level] !== undefined) levelCounts[item.level]++;
      if (item.category && categoryCounts[item.category] !== undefined) {
        categoryCounts[item.category]++;
      }

      // Time range check
      if (itemTime < startTimeMs || itemTime > endTimeMs) continue;

      // Level check
      if (params.level && params.level !== 'all' && item.level !== params.level) {
        continue;
      }

      // Service check
      if (params.service && params.service !== 'all' && item.service !== params.service) {
        continue;
      }

      // Category check
      if (params.category && params.category !== 'all' && item.category !== params.category) {
        continue;
      }

      // Exact ID filters
      if (params.traceId && item.traceId !== params.traceId) continue;
      if (params.requestId && item.requestId !== params.requestId) continue;
      if (params.userId && item.userId !== params.userId) continue;
      if (params.action && item.action !== params.action) continue;

      // Search text filter
      if (search) {
        const matchFound =
          item.message.toLowerCase().includes(search) ||
          item.action?.toLowerCase().includes(search) ||
          item.traceId?.toLowerCase().includes(search) ||
          item.requestId?.toLowerCase().includes(search) ||
          item.userId?.toLowerCase().includes(search) ||
          item.userEmail?.toLowerCase().includes(search) ||
          (item.metadata && JSON.stringify(item.metadata).toLowerCase().includes(search)) ||
          (item.error && JSON.stringify(item.error).toLowerCase().includes(search));

        if (!matchFound) continue;
      }

      matched.push(item);
    }

    const total = matched.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const logs = matched.slice(startIndex, startIndex + limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
      levelCounts,
      categoryCounts,
    };
  }

  public getRecent(count = 50): StructuredLog[] {
    return this.buffer.slice(-count).reverse();
  }

  public clear(): void {
    this.buffer = [];
  }
}

export const logStore = new LogStore();
