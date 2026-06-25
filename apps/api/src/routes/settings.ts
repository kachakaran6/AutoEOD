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
  autoSend: z.boolean().optional(),
  managerEmail: z.string().email().nullable().optional(),
  ccEmails: z.string().nullable().optional(),
  reportTemplate: z.enum(['professional', 'short', 'detailed']).optional(),
  reportLanguage: z.enum(['english', 'hindi', 'gujarati']).optional(),
  chatgptCaptureContent: z.boolean().optional(),
});

// ── GET /api/settings ─────────────────────────────────────────────────────────
settingsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  let settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId } });
  }
  const emailConnection = await prisma.emailConnection.findUnique({
    where: { userId },
  });

  let safeConnection = null;
  if (emailConnection) {
    const { accessTokenEnc, refreshTokenEnc, ...rest } = emailConnection;
    safeConnection = rest;
  }

  res.json({
    ...settings,
    emailConnection: safeConnection,
  });
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

// ── DELETE /api/settings/email-connection ────────────────────────────────────
settingsRouter.delete('/email-connection', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    await prisma.emailConnection.delete({
      where: { userId }
    });
    res.json({ success: true });
  } catch (err) {
    // If it doesn't exist, ignore
    res.json({ success: true });
  }
});
