// apps/api/src/lib/observability/tracer.ts
// OpenTelemetry-compatible distributed tracing & waterfall span tracker

import {
  getObservabilityContext,
  generateSpanId,
  generateTraceId,
  ObservabilityContext,
} from './context';
import { redactSensitiveData } from './redaction';

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER' | 'INTERNAL';
  service: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR' | 'UNSET';
  attributes: Record<string, any>;
  events: SpanEvent[];
  error?: {
    message: string;
    stack?: string;
  };
}

export interface TraceSummary {
  traceId: string;
  rootSpanName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  service: string;
  httpMethod?: string;
  httpRoute?: string;
  httpStatus?: number;
  userId?: string;
  userEmail?: string;
  spanCount: number;
  errorCount: number;
}

export interface TraceDetail extends TraceSummary {
  spans: Span[];
}

class TraceStore {
  private traces = new Map<string, Span[]>();
  private traceSummaries: TraceSummary[] = [];
  private maxTraces = 2000;

  public addSpan(span: Span): void {
    try {
      if (!this.traces.has(span.traceId)) {
        this.traces.set(span.traceId, []);
      }
      const spans = this.traces.get(span.traceId)!;
      spans.push(span);

      // If root span (no parentSpanId or kind === 'SERVER') finishes, create/update trace summary
      this.updateTraceSummary(span.traceId);

      // Trim if exceeding capacity
      if (this.traceSummaries.length > this.maxTraces) {
        const oldest = this.traceSummaries.shift();
        if (oldest) {
          this.traces.delete(oldest.traceId);
        }
      }
    } catch (err) {
      console.error('TraceStore error (fail-safe):', err);
    }
  }

  private updateTraceSummary(traceId: string): void {
    const spans = this.traces.get(traceId);
    if (!spans || spans.length === 0) return;

    const rootSpan = spans.find((s) => !s.parentSpanId) || spans[0];
    const startTime = Math.min(...spans.map((s) => s.startTime));
    const finishedSpans = spans.filter((s) => s.endTime !== undefined);
    const endTime = finishedSpans.length > 0 ? Math.max(...finishedSpans.map((s) => s.endTime!)) : Date.now();
    const durationMs = Math.max(1, endTime - startTime);
    const hasError = spans.some((s) => s.status === 'ERROR');
    const errorCount = spans.filter((s) => s.status === 'ERROR').length;

    const summary: TraceSummary = {
      traceId,
      rootSpanName: rootSpan.name,
      startTime,
      endTime,
      durationMs,
      status: hasError ? 'ERROR' : 'OK',
      service: rootSpan.service,
      httpMethod: rootSpan.attributes['http.method'],
      httpRoute: rootSpan.attributes['http.route'] || rootSpan.attributes['http.target'],
      httpStatus: rootSpan.attributes['http.status_code'],
      userId: rootSpan.attributes['user.id'],
      userEmail: rootSpan.attributes['user.email'],
      spanCount: spans.length,
      errorCount,
    };

    const existingIndex = this.traceSummaries.findIndex((t) => t.traceId === traceId);
    if (existingIndex >= 0) {
      this.traceSummaries[existingIndex] = summary;
    } else {
      this.traceSummaries.push(summary);
    }
  }

  public getTrace(traceId: string): TraceDetail | null {
    const spans = this.traces.get(traceId);
    if (!spans || spans.length === 0) return null;

    const summary = this.traceSummaries.find((t) => t.traceId === traceId);
    const sortedSpans = [...spans].sort((a, b) => a.startTime - b.startTime);

    return {
      ...(summary || {
        traceId,
        rootSpanName: sortedSpans[0].name,
        startTime: sortedSpans[0].startTime,
        endTime: sortedSpans[sortedSpans.length - 1].endTime || Date.now(),
        durationMs: (sortedSpans[sortedSpans.length - 1].endTime || Date.now()) - sortedSpans[0].startTime,
        status: sortedSpans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
        service: sortedSpans[0].service,
        spanCount: sortedSpans.length,
        errorCount: sortedSpans.filter((s) => s.status === 'ERROR').length,
      }),
      spans: sortedSpans,
    };
  }

  public queryTraces(params: {
    service?: string;
    status?: string;
    route?: string;
    search?: string;
    minDurationMs?: number;
    startTime?: string;
    endTime?: string;
    page?: number;
    limit?: number;
  }): { traces: TraceSummary[]; total: number; page: number; limit: number; totalPages: number } {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(params.limit || 50, 200);
    const search = params.search?.toLowerCase().trim();
    const startTimeMs = params.startTime ? new Date(params.startTime).getTime() : 0;
    const endTimeMs = params.endTime ? new Date(params.endTime).getTime() : Infinity;

    const filtered: TraceSummary[] = [];

    for (let i = this.traceSummaries.length - 1; i >= 0; i--) {
      const item = this.traceSummaries[i];

      if (item.startTime < startTimeMs || item.startTime > endTimeMs) continue;
      if (params.service && params.service !== 'all' && item.service !== params.service) continue;
      if (params.status && params.status !== 'all' && item.status !== params.status) continue;
      if (params.minDurationMs && item.durationMs < params.minDurationMs) continue;
      if (params.route && item.httpRoute && !item.httpRoute.includes(params.route)) continue;

      if (search) {
        const match =
          item.traceId.toLowerCase().includes(search) ||
          item.rootSpanName.toLowerCase().includes(search) ||
          item.httpRoute?.toLowerCase().includes(search) ||
          item.userId?.toLowerCase().includes(search) ||
          item.userEmail?.toLowerCase().includes(search);

        if (!match) continue;
      }

      filtered.push(item);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const traces = filtered.slice(startIndex, startIndex + limit);

    return { traces, total, page, limit, totalPages };
  }
}

export const traceStore = new TraceStore();

/**
 * Creates and starts a new tracing span linked to the current async context
 */
export function startSpan(
  name: string,
  options: {
    kind?: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER' | 'INTERNAL';
    service?: string;
    attributes?: Record<string, any>;
    parentSpanId?: string;
  } = {}
): {
  span: Span;
  end: (error?: Error | null, additionalAttrs?: Record<string, any>) => void;
  addEvent: (eventName: string, attributes?: Record<string, any>) => void;
  setAttribute: (key: string, value: any) => void;
} {
  const ctx = getObservabilityContext();
  const traceId = ctx?.traceId || generateTraceId();
  const spanId = generateSpanId();
  const parentSpanId = options.parentSpanId || ctx?.spanId;
  const service = options.service || ctx?.service || 'api';
  const startTime = Date.now();

  const span: Span = {
    traceId,
    spanId,
    parentSpanId: parentSpanId !== spanId ? parentSpanId : undefined,
    name,
    kind: options.kind || 'INTERNAL',
    service,
    startTime,
    status: 'UNSET',
    attributes: redactSensitiveData({
      ...options.attributes,
      'environment': ctx?.environment || process.env.NODE_ENV || 'development',
      'user.id': ctx?.userId,
      'user.email': ctx?.userEmail,
    }),
    events: [],
  };

  return {
    span,
    addEvent: (eventName: string, attributes: Record<string, any> = {}) => {
      span.events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes: redactSensitiveData(attributes),
      });
    },
    setAttribute: (key: string, value: any) => {
      span.attributes[key] = redactSensitiveData(value);
    },
    end: (error?: Error | null, additionalAttrs: Record<string, any> = {}) => {
      span.endTime = Date.now();
      span.durationMs = Math.max(1, span.endTime - span.startTime);

      if (additionalAttrs) {
        Object.assign(span.attributes, redactSensitiveData(additionalAttrs));
      }

      if (error) {
        span.status = 'ERROR';
        span.error = {
          message: error.message,
          stack: error.stack,
        };
      } else {
        span.status = 'OK';
      }

      traceStore.addSpan(span);
    },
  };
}

/**
 * Traces an async execution block automatically
 */
export async function traceAsync<T>(
  name: string,
  fn: (spanHelper: ReturnType<typeof startSpan>) => Promise<T>,
  options?: Parameters<typeof startSpan>[1]
): Promise<T> {
  const spanHelper = startSpan(name, options);
  try {
    const result = await fn(spanHelper);
    spanHelper.end();
    return result;
  } catch (err: any) {
    spanHelper.end(err);
    throw err;
  }
}
