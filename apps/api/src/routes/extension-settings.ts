import { Router, Request, Response } from 'express';
import { prisma } from '@autoeod/db';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const extensionSettingsRouter = Router();
extensionSettingsRouter.use(requireAuth);

const ExtensionSettingsSchema = z.object({
  globalPaused: z.boolean().optional(),
  tier1GlobalDefault: z.boolean().optional(),
  tier1DomainAllowlist: z.array(z.string()).optional(),
  excludedDomains: z.array(z.string()).optional(),
});

// GET /api/extension-settings
extensionSettingsRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  let settings = await prisma.userExtensionSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prisma.userExtensionSettings.create({
      data: { userId },
    });
  }

  res.json(settings);
});

// PATCH /api/extension-settings
extensionSettingsRouter.patch('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  const parsed = ExtensionSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.flatten() });
    return;
  }

  const { globalPaused, tier1GlobalDefault, tier1DomainAllowlist, excludedDomains } = parsed.data;

  const updateData: any = {};
  if (globalPaused !== undefined) updateData.globalPaused = globalPaused;
  if (tier1GlobalDefault !== undefined) updateData.tier1GlobalDefault = tier1GlobalDefault;
  if (tier1DomainAllowlist !== undefined) updateData.tier1DomainAllowlist = tier1DomainAllowlist;
  if (excludedDomains !== undefined) updateData.excludedDomains = excludedDomains;

  let settings = await prisma.userExtensionSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userExtensionSettings.create({
      data: { userId, ...updateData },
    });
  } else {
    settings = await prisma.userExtensionSettings.update({
      where: { userId },
      data: updateData,
    });
  }

  logger.info({ userId }, 'Updated user extension settings');
  res.json(settings);
});
