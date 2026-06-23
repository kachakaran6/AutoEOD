import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../../middleware/auth';
import { encrypt } from '../../lib/crypto';
import { logger } from '../../lib/logger';

export const googleAuthRouter = Router();

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_SCOPES = 'email profile https://www.googleapis.com/auth/gmail.send';

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('Google OAuth environment variables not configured');
  }
  return { clientId, clientSecret, callbackUrl };
}

// ── GET /api/auth/google/connect ──────────────────────────────────────────────
googleAuthRouter.get('/connect', (req: Request, res: Response, next): void => {
  const tokenFromQuery = req.query.token as string | undefined;
  if (tokenFromQuery) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  requireAuth(req, res, next);
}, (req: Request, res: Response): void => {
  const { clientId, callbackUrl } = getGoogleConfig();
  const state = crypto.randomBytes(32).toString('hex');

  res.cookie(GOOGLE_STATE_COOKIE, JSON.stringify({ state, userId: req.userId }), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/google',
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
googleAuthRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${frontendUrl}/settings?error=missing_params`);
    return;
  }

  const cookieRaw = req.cookies?.[GOOGLE_STATE_COOKIE];
  if (!cookieRaw) {
    res.redirect(`${frontendUrl}/settings?error=state_expired`);
    return;
  }

  let cookieData: { state: string; userId: string };
  try {
    cookieData = JSON.parse(cookieRaw);
  } catch {
    res.redirect(`${frontendUrl}/settings?error=state_invalid`);
    return;
  }

  if (cookieData.state !== state) {
    res.redirect(`${frontendUrl}/settings?error=state_mismatch`);
    return;
  }

  res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/api/auth/google' });

  const { clientId, clientSecret, callbackUrl } = getGoogleConfig();
  const userId = cookieData.userId;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
    });
    
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!tokenData.access_token || tokenData.error) {
      logger.error({ tokenData, userId }, 'Google token exchange failed');
      res.redirect(`${frontendUrl}/settings?error=token_exchange_failed`);
      return;
    }

    // Fetch user profile
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = (await userRes.json()) as { id: string; email: string; name: string; picture: string };

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Some OAuth flows don't return refresh token if already authorized, so we only update if it exists
    const updateData: any = {
      provider: 'google',
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      accessTokenEnc: encrypt(tokenData.access_token),
      expiresAt,
    };
    
    if (tokenData.refresh_token) {
      updateData.refreshTokenEnc = encrypt(tokenData.refresh_token);
    }

    await prisma.emailConnection.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'google',
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        accessTokenEnc: encrypt(tokenData.access_token),
        refreshTokenEnc: encrypt(tokenData.refresh_token || ''), // Requires prompt=consent initially
        expiresAt,
      },
      update: updateData,
    });

    logger.info({ userId, email: googleUser.email }, 'Google email connected');
    res.redirect(`${frontendUrl}/settings?connected=google`);
  } catch (err) {
    logger.error(err, 'Failed to process Google callback');
    res.redirect(`${frontendUrl}/settings?error=server_error`);
  }
});
