// apps/api/src/routes/integrations.ts
// GitHub OAuth connect/callback/disconnect

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

export const integrationsRouter = Router();

const GITHUB_STATE_COOKIE = 'gh_oauth_state';
const GITHUB_SCOPES = 'repo read:user';

function getGitHubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL;
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('GitHub OAuth environment variables not configured');
  }
  return { clientId, clientSecret, callbackUrl };
}

// Queue for triggering immediate sync after connect
const githubSyncQueue = new Queue('github-sync', { connection: redisConnection as any });

// ── GET /api/integrations/github/connect ─────────────────────────────────────
// User must be logged in. Redirects to GitHub OAuth.
// Accepts Authorization header OR ?token= query param (needed because browser
// full-page redirects cannot set custom headers).
integrationsRouter.get('/github/connect', (req: Request, res: Response, next): void => {
  // Accept token from query param for the OAuth redirect flow
  const tokenFromQuery = req.query.token as string | undefined;
  if (tokenFromQuery) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  requireAuth(req, res, next);
}, (req: Request, res: Response): void => {
  const { clientId, callbackUrl } = getGitHubConfig();
  const state = crypto.randomBytes(32).toString('hex');

  // Store state + userId in a signed cookie (expires in 10 min)
  res.cookie(GITHUB_STATE_COOKIE, JSON.stringify({ state, userId: req.userId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/integrations',
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: GITHUB_SCOPES,
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// ── GET /api/integrations/github/callback ────────────────────────────────────
integrationsRouter.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${frontendUrl}/integrations?error=missing_params`);
    return;
  }

  // Verify state cookie
  const cookieRaw = req.cookies?.[GITHUB_STATE_COOKIE];
  if (!cookieRaw) {
    res.redirect(`${frontendUrl}/integrations?error=state_expired`);
    return;
  }

  let cookieData: { state: string; userId: string };
  try {
    cookieData = JSON.parse(cookieRaw);
  } catch {
    res.redirect(`${frontendUrl}/integrations?error=state_invalid`);
    return;
  }

  if (cookieData.state !== state) {
    res.redirect(`${frontendUrl}/integrations?error=state_mismatch`);
    return;
  }

  res.clearCookie(GITHUB_STATE_COOKIE, { path: '/api/integrations' });

  const { clientId, clientSecret } = getGitHubConfig();
  const userId = cookieData.userId;

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
    };

    if (!tokenData.access_token || tokenData.error) {
      logger.error({ tokenData, userId }, 'GitHub token exchange failed');
      res.redirect(`${frontendUrl}/integrations?error=token_exchange_failed`);
      return;
    }

    // Fetch GitHub user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'AutoEOD/1.0' },
    });
    const githubUser = (await userRes.json()) as { id: number; login: string };

    // Encrypt token and upsert integration
    const encryptedToken = encrypt(tokenData.access_token);
    await prisma.githubIntegration.upsert({
      where: { userId },
      create: {
        userId,
        githubUserId: String(githubUser.id),
        githubUsername: githubUser.login,
        accessTokenEnc: encryptedToken,
        scopes: tokenData.scope || GITHUB_SCOPES,
        needsReconnect: false,
      },
      update: {
        githubUserId: String(githubUser.id),
        githubUsername: githubUser.login,
        accessTokenEnc: encryptedToken,
        scopes: tokenData.scope || GITHUB_SCOPES,
        needsReconnect: false,
        lastSyncCursor: null,
      },
    });

    logger.info({ userId, githubUsername: githubUser.login }, 'GitHub connected');

    // Trigger immediate sync
    await githubSyncQueue.add('sync-single', { userId }, { jobId: `sync-single-${userId}-${Date.now()}` });

    res.redirect(`${frontendUrl}/integrations?github=connected`);
  } catch (err) {
    logger.error({ err, userId }, 'GitHub OAuth callback error');
    res.redirect(`${frontendUrl}/integrations?error=server_error`);
  }
});

// ── DELETE /api/integrations/github ─────────────────────────────────────────
integrationsRouter.delete('/github', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  await prisma.githubIntegration.deleteMany({ where: { userId } });
  logger.info({ userId }, 'GitHub disconnected');
  res.json({ message: 'GitHub disconnected' });
});

// ── GET /api/integrations ─────────────────────────────────────────────────────
// Returns current integration status
integrationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const github = await prisma.githubIntegration.findUnique({
    where: { userId },
    select: {
      githubUsername: true,
      scopes: true,
      connectedAt: true,
      lastSyncedAt: true,
      needsReconnect: true,
    },
  });

  res.json({
    github: github
      ? {
          connected: true,
          username: github.githubUsername,
          scopes: github.scopes,
          connectedAt: github.connectedAt,
          lastSyncedAt: github.lastSyncedAt,
          needsReconnect: github.needsReconnect,
        }
      : { connected: false },
  });
});

// Helper to get decrypted access token (used by worker, exported for reuse)
export async function getDecryptedGitHubToken(userId: string): Promise<string | null> {
  const integration = await prisma.githubIntegration.findUnique({ where: { userId } });
  if (!integration) return null;
  return decrypt(integration.accessTokenEnc);
}
