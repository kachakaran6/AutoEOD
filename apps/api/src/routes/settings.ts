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
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().nullable().optional(),
  smtpUser: z.string().nullable().optional(),
  smtpPass: z.string().nullable().optional(), // Raw password from frontend
});

// ── GET /api/settings ─────────────────────────────────────────────────────────
settingsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  let settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId } });
  }

  // Strip encrypted password before sending to frontend
  const { smtpPassEnc, ...safeSettings } = settings;
  res.json({
    ...safeSettings,
    smtpConfigured: !!smtpPassEnc,
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

  const { smtpPass, ...otherData } = parse.data;
  const updateData: any = { ...otherData };

  if (smtpPass !== undefined) {
    if (smtpPass === null || smtpPass === '') {
      updateData.smtpPassEnc = null;
    } else {
      const { encrypt } = await import('../lib/crypto');
      updateData.smtpPassEnc = encrypt(smtpPass);
    }
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  });

  const { smtpPassEnc, ...safeSettings } = settings;
  res.json({
    ...safeSettings,
    smtpConfigured: !!smtpPassEnc,
  });
});

// ── POST /api/settings/test-smtp ──────────────────────────────────────────────
settingsRouter.post('/test-smtp', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  
  if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassEnc) {
    res.status(400).json({ error: 'SMTP settings are incomplete. Please save them first.' });
    return;
  }

  try {
    const { decrypt } = await import('../lib/crypto');
    const pass = decrypt(settings.smtpPassEnc);
    
    // Dynamic import to avoid top-level require if nodemailer isn't installed yet
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: settings.smtpUser,
        pass,
      },
    });

    await transporter.verify();
    
    // Send a test email to the user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await transporter.sendMail({
        from: `AutoEOD <${settings.smtpUser}>`,
        to: user.email,
        subject: 'AutoEOD: SMTP Connection Successful',
        text: 'Your SMTP connection has been configured successfully! AutoEOD will now send your daily reports using this email account.',
      });
    }

    res.json({ message: 'Connection successful. A test email was sent.' });
  } catch (err: any) {
    res.status(400).json({ error: `SMTP Connection failed: ${err.message}` });
  }
});
