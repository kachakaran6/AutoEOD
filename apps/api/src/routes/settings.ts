// apps/api/src/routes/settings.ts
// GET + PATCH /api/settings

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';

export const settingsRouter = Router();

const SettingsSchema = z.object({
  timezone: z.string().optional(),
  workStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  workEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  reportTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  autoGenerate: z.boolean().optional(),
  managerEmail: z.string().email().nullable().optional(),
  ccEmails: z.string().nullable().optional(),
  reportTemplate: z.enum(['professional', 'short', 'detailed']).optional(),
  reportLanguage: z.enum(['english', 'hindi', 'gujarati']).optional(),
});

// ── GET /api/settings ─────────────────────────────────────────────────────────
settingsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    // Create defaults if missing
    const created = await prisma.userSettings.create({ data: { userId } });
    res.json(created);
    return;
  }
  res.json(settings);
});

// ── PATCH /api/settings ───────────────────────────────────────────────────────
settingsRouter.patch('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const parse = SettingsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...parse.data },
    update: parse.data,
  });

  res.json(settings);
});
