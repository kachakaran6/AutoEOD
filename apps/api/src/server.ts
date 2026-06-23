// apps/api/src/server.ts
// AutoEOD API server entry point

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';

// Route imports
import { authRouter } from './routes/auth';
import { integrationsRouter } from './routes/integrations';
import { activityRouter } from './routes/activity';
import { dashboardRouter } from './routes/dashboard';
import { reportsRouter } from './routes/reports';
import { settingsRouter } from './routes/settings';
import { notificationsRouter } from './routes/notifications';
import { extensionTokensRouter } from './routes/extensionTokens';
import { extensionActivityRouter } from './routes/extensionActivity';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (!origin || origin === allowed || origin.startsWith('chrome-extension://')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Don't log health checks
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// ── Auth rate limiter (brute force protection) ─────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/extension-tokens', extensionTokensRouter);
app.use('/api/extension/activity', extensionActivityRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`AutoEOD API running on http://localhost:${PORT}`);
});

export default app;
