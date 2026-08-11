// apps/api/src/routes/config.ts
// GET /api/config — Public endpoint for client app Remote Configuration

import { Router, Request, Response } from 'express';
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';

export const configRouter = Router();

// Helper to retrieve or lazy-initialize global SystemConfig
export async function getOrCreateSystemConfig() {
  let config = await prisma.systemConfig.findUnique({
    where: { id: 'global' },
  });

  if (!config) {
    const defaultApiUrl = process.env.RENDER_EXTERNAL_URL || 'https://autoeod.onrender.com';
    const defaultWebUrl = process.env.FRONTEND_URL || 'https://autoeod.onrender.com';
    
    config = await prisma.systemConfig.create({
      data: {
        id: 'global',
        apiBaseUrl: defaultApiUrl,
        webBaseUrl: defaultWebUrl,
        maintenanceMode: false,
        forceUpdate: false,
        minExtensionVersion: '1.0.0',
        minDesktopVersion: '1.0.0',
      },
    });
    logger.info({ config }, 'Initialized default SystemConfig row in database');
  }

  return config;
}

// ── GET /api/config ───────────────────────────────────────────────────────────
configRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await getOrCreateSystemConfig();
    res.json({
      api_base_url: config.apiBaseUrl,
      web_base_url: config.webBaseUrl,
      maintenance_mode: config.maintenanceMode,
      force_update: config.forceUpdate,
      min_extension_version: config.minExtensionVersion,
      min_desktop_version: config.minDesktopVersion,
      updated_at: config.updatedAt,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch public system config');
    // Fallback response if database connection fails momentarily
    res.json({
      api_base_url: process.env.RENDER_EXTERNAL_URL || 'https://autoeod.onrender.com',
      web_base_url: process.env.FRONTEND_URL || 'https://autoeod.onrender.com',
      maintenance_mode: false,
      force_update: false,
      min_extension_version: '1.0.0',
      min_desktop_version: '1.0.0',
    });
  }
});
