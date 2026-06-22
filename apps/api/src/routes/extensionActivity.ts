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

const ConversationMessageSchema = z.object({
  role: z.string(),
  excerpt: z.string(),
});

const ConversationSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  lastSeenAt: z.string().datetime(),
  messages: z.array(ConversationMessageSchema).optional(),
});

const ExtensionActivityPayloadSchema = z.object({
  conversations: z.array(ConversationSchema),
});

// â”€â”€ POST /api/extension/activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
extensionActivityRouter.post('/', requireExtensionAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  
  const parseResult = ExtensionActivityPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    return;
  }

  const { conversations } = parseResult.data;

  // Check privacy settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { chatgptCaptureContent: true },
  });

  const captureContent = settings?.chatgptCaptureContent ?? false;

  let processedCount = 0;

  for (const conv of conversations) {
    const occurredAt = new Date(conv.lastSeenAt);

    // Strip messages if content capture is disabled
    let messages = conv.messages;
    if (!captureContent) {
      messages = undefined;
    }

    const rawPayload = {
      title: conv.title,
      messageCount: messages ? messages.length : 0,
      lastSeenAt: conv.lastSeenAt,
      ...(messages ? { messages } : {}),
    };

    await prisma.activityEvent.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source: 'chatgpt',
          externalId: conv.externalId,
        },
      },
      create: {
        userId,
        source: 'chatgpt',
        type: 'chatgpt_conversation',
        externalId: conv.externalId,
        repo: '',
        title: conv.title,
        url: `https://chatgpt.com/c/${conv.externalId}`,
        occurredAt,
        rawPayload,
      },
      update: {
        title: conv.title,
        occurredAt,
        rawPayload,
      },
    });

    processedCount++;
  }

  res.json({ message: 'Activity processed successfully', count: processedCount });
});
