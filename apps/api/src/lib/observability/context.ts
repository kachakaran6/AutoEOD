// apps/api/src/lib/observability/context.ts
// AsyncLocalStorage context propagation for correlation IDs across asynchronous lifecycles

import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export interface ObservabilityContext {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  service: string;
  environment: string;
  route?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<ObservabilityContext>();

export function generateTraceId(): string {
  return 'tr_' + crypto.randomBytes(12).toString('hex');
}

export function generateSpanId(): string {
  return 'sp_' + crypto.randomBytes(8).toString('hex');
}

export function generateRequestId(): string {
  return 'req_' + crypto.randomBytes(8).toString('hex');
}

export function runWithObservabilityContext<T>(
  context: ObservabilityContext,
  fn: () => T
): T {
  return asyncLocalStorage.run(context, fn);
}

export function getObservabilityContext(): ObservabilityContext | undefined {
  return asyncLocalStorage.getStore();
}

export function updateObservabilityContext(partial: Partial<ObservabilityContext>): void {
  const current = asyncLocalStorage.getStore();
  if (current) {
    Object.assign(current, partial);
  }
}
