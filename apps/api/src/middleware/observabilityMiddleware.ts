// apps/api/src/middleware/observabilityMiddleware.ts
// Request tracing, correlation propagation, metrics accumulation, and security monitoring middleware

import { Request, Response, NextFunction } from 'express';
import {
  runWithObservabilityContext,
  generateRequestId,
  generateTraceId,
  generateSpanId,
  ObservabilityContext,
  startSpan,
  metricsEngine,
  logger,
  ErrorTracker,
  SecurityService,
  AlertEngine,
  EventTaxonomy,
} from '../lib/observability';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      traceId?: string;
      spanId?: string;
      startTime?: number;
    }
  }
}

export function observabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Ignore raw health check polling from flooding traces
  if (req.path === '/health') {
    next();
    return;
  }

  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  const traceId = (req.headers['x-trace-id'] as string) || (req.headers['traceparent'] as string) || generateTraceId();
  const spanId = generateSpanId();
  const startTime = Date.now();

  req.requestId = requestId;
  req.traceId = traceId;
  req.spanId = spanId;
  req.startTime = startTime;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Trace-Id', traceId);

  const context: ObservabilityContext = {
    requestId,
    traceId,
    spanId,
    service: 'api',
    environment: process.env.NODE_ENV || 'production',
    route: req.baseUrl + (req.route?.path || req.path),
    method: req.method,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    startTime,
  };

  runWithObservabilityContext(context, () => {
    const spanHelper = startSpan(`HTTP ${req.method} ${req.baseUrl || ''}${req.path}`, {
      kind: 'SERVER',
      service: 'api',
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        'http.route': req.baseUrl + (req.route?.path || req.path),
        'http.user_agent': req.headers['user-agent'],
        'client.ip': req.ip,
        'request.id': requestId,
        'trace.id': traceId,
      },
    });

    res.on('finish', () => {
      const durationMs = Math.max(1, Date.now() - startTime);
      const statusCode = res.statusCode;
      const normalizedRoute = req.baseUrl + (req.route?.path || req.path);

      spanHelper.setAttribute('http.status_code', statusCode);
      spanHelper.setAttribute('http.duration_ms', durationMs);
      if (req.userId) {
        spanHelper.setAttribute('user.id', req.userId);
      }

      // Complete span
      spanHelper.end(statusCode >= 500 ? new Error(`HTTP ${statusCode} Response`) : null);

      // Record metrics
      metricsEngine.recordHttpRequest({
        method: req.method,
        route: normalizedRoute,
        statusCode,
        durationMs,
      });

      // Structured logging
      const logPayload = {
        action: statusCode >= 400 ? EventTaxonomy.API.REQUEST_FAILED : EventTaxonomy.API.REQUEST_COMPLETED,
        method: req.method,
        route: normalizedRoute,
        statusCode,
        durationMs,
        ip: req.ip,
        userId: req.userId,
      };

      if (statusCode >= 500) {
        logger.error(logPayload, `HTTP ${req.method} ${normalizedRoute} -> ${statusCode} (${durationMs}ms)`, 'api');
      } else if (statusCode >= 400) {
        logger.warn(logPayload, `HTTP ${req.method} ${normalizedRoute} -> ${statusCode} (${durationMs}ms)`, 'api');
      } else {
        logger.info(logPayload, `HTTP ${req.method} ${normalizedRoute} -> ${statusCode} (${durationMs}ms)`, 'api');
      }

      // Security check on 401/403
      if (statusCode === 401 || statusCode === 403) {
        SecurityService.recordEvent({
          eventType: statusCode === 403 ? EventTaxonomy.SECURITY.PERMISSION_DENIED : EventTaxonomy.SECURITY.UNAUTHORIZED_ACCESS,
          severity: statusCode === 403 ? 'MEDIUM' : 'LOW',
          userId: req.userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          route: normalizedRoute,
          method: req.method,
          statusCode,
        });
      }

      // Background alert rule evaluation
      setImmediate(() => {
        AlertEngine.evaluateRules().catch(() => {});
      });
    });

    next();
  });
}
