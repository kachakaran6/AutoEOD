import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@autoeod/db';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '../lib/logger';

export const extensionActivityRouter = Router();

// Middleware to authenticate via ExtensionToken
async function requireExtensionAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const extensionToken = await prisma.extensionToken.findUnique({
    where: { tokenHash },
  });

  if (!extensionToken || extensionToken.revokedAt) {
    res.status(401).json({ error: 'Invalid or revoked token' });
    return;
  }

  // Attach userId to request
  req.userId = extensionToken.userId;

  // Update lastUsedAt in the background
  prisma.extensionToken.update({
    where: { id: extensionToken.id },
    data: { lastUsedAt: new Date() },
  }).catch(err => logger.error({ err }, 'Failed to update lastUsedAt'));

  next();
}

const BrowserActivitySchema = z.object({
  domain: z.string(),
  url: z.string(),
  pageTitle: z.string(),
  tabOpenedAt: z.string().datetime(),
  tabClosedAt: z.string().datetime().nullable().optional(),
  durationSeconds: z.number(),
  captureTier: z.number().int().min(0).max(2),
  snapshotText: z.string().nullable().optional(),
  adapterPayload: z.any().optional(),
});

const UniversalPayloadSchema = z.object({
  activities: z.array(BrowserActivitySchema),
});

// ── POST /api/extension/browser-activity ─────────────────────────────────────
extensionActivityRouter.post('/', requireExtensionAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  
  const parseResult = UniversalPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    return;
  }

  const { activities } = parseResult.data;

  // Fetch settings to double check global pause and exclusions just in case
  const settings = await prisma.userExtensionSettings.findUnique({
    where: { userId },
  });

  const globalPaused = settings?.globalPaused ?? false;
  const excludedDomains = (settings?.excludedDomains as string[]) || [];
  
  if (globalPaused) {
    res.json({ message: 'Global pause active, activities ignored', count: 0 });
    return;
  }

  let processedCount = 0;

  for (const activity of activities) {
    if (excludedDomains.includes(activity.domain)) {
      continue; // Skip excluded domains
    }

    await prisma.browserActivityLog.create({
      data: {
        userId,
        domain: activity.domain,
        url: activity.url,
        pageTitle: activity.pageTitle,
        tabOpenedAt: new Date(activity.tabOpenedAt),
        tabClosedAt: activity.tabClosedAt ? new Date(activity.tabClosedAt) : null,
        durationSeconds: activity.durationSeconds,
        captureTier: activity.captureTier,
        snapshotText: activity.snapshotText,
        adapterPayload: activity.adapterPayload,
      },
    });

    processedCount++;
  }

  res.json({ message: 'Activity processed successfully', count: processedCount });
});
