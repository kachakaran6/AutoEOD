// apps/api/src/lib/observability/index.ts
// Production Enterprise Observability Platform Exports

import os from 'os';
import pino from 'pino';
import { getObservabilityContext } from './context';
import { redactSensitiveData } from './redaction';
import { logStore, StructuredLog } from './logStore';

// Initialize core Pino instance with development pretty-printing if needed
const basePino = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

function createStructuredLog(
  level: StructuredLog['level'],
  msgOrObj: string | Record<string, any>,
  maybeMsg?: string,
  category: StructuredLog['category'] = 'app'
): StructuredLog {
  const ctx = getObservabilityContext();
  let message = '';
  let metadata: Record<string, any> | undefined;
  let errorObj: any;

  if (typeof msgOrObj === 'string') {
    message = msgOrObj;
  } else if (typeof msgOrObj === 'object' && msgOrObj !== null) {
    message = maybeMsg || msgOrObj.message || msgOrObj.msg || msgOrObj.action || 'Log Event';
    const { message: _m, msg: _msg, err, error, ...rest } = msgOrObj;
    metadata = redactSensitiveData(rest);
    if (err || error) {
      const e = err || error;
      errorObj = {
        name: e.name,
        message: e.message,
        stack: e.stack,
        code: e.code,
      };
    }
  }

  const structured: StructuredLog = {
    id: 'log_' + Math.random().toString(36).slice(2, 11),
    timestamp: new Date().toISOString(),
    level,
    service: ctx?.service || 'api',
    environment: ctx?.environment || process.env.NODE_ENV || 'production',
    application: 'autoeod',
    hostname: os.hostname(),
    processId: process.pid,
    requestId: ctx?.requestId,
    traceId: ctx?.traceId,
    spanId: ctx?.spanId,
    userId: ctx?.userId,
    userEmail: ctx?.userEmail,
    action: typeof msgOrObj === 'object' && msgOrObj?.action ? String(msgOrObj.action) : undefined,
    category,
    message,
    metadata,
    error: errorObj,
  };

  return structured;
}

/**
 * Enterprise Structured Logger with Automatic Context, Dual Sinks & Fail-Safe Pipeline
 */
export const logger = {
  trace: (msgOrObj: string | Record<string, any>, msg?: string) => {
    try {
      basePino.trace(msgOrObj as any, msg);
      logStore.push(createStructuredLog('trace', msgOrObj, msg));
    } catch {}
  },
  debug: (msgOrObj: string | Record<string, any>, msg?: string) => {
    try {
      basePino.debug(msgOrObj as any, msg);
      logStore.push(createStructuredLog('debug', msgOrObj, msg));
    } catch {}
  },
  info: (msgOrObj: string | Record<string, any>, msg?: string, category?: StructuredLog['category']) => {
    try {
      basePino.info(msgOrObj as any, msg);
      logStore.push(createStructuredLog('info', msgOrObj, msg, category));
    } catch {}
  },
  warn: (msgOrObj: string | Record<string, any>, msg?: string, category?: StructuredLog['category']) => {
    try {
      basePino.warn(msgOrObj as any, msg);
      logStore.push(createStructuredLog('warn', msgOrObj, msg, category));
    } catch {}
  },
  error: (msgOrObj: string | Record<string, any>, msg?: string, category?: StructuredLog['category']) => {
    try {
      basePino.error(msgOrObj as any, msg);
      logStore.push(createStructuredLog('error', msgOrObj, msg, category));
    } catch {}
  },
  fatal: (msgOrObj: string | Record<string, any>, msg?: string) => {
    try {
      basePino.fatal(msgOrObj as any, msg);
      logStore.push(createStructuredLog('fatal', msgOrObj, msg));
    } catch {}
  },
};

export * from './events';
export * from './redaction';
export * from './context';
export * from './logStore';
export * from './tracer';
export * from './metrics';
export * from './errorTracker';
export * from './auditService';
export * from './securityService';
export * from './alertEngine';
export * from './retentionService';
export * from './exportService';
