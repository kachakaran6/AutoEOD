import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../../middleware/auth';
import { encrypt } from '../../lib/crypto';
import { logger } from '../../lib/logger';

export const zohoAuthRouter = Router();

const ZOHO_STATE_COOKIE = 'zoho_oauth_state';
const ZOHO_SCOPES = 'ZohoMail.messages.CREATE,ZohoMail.messages.UPDATE,ZohoMail.accounts.READ';

function getZohoConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const callbackUrl = process.env.ZOHO_CALLBACK_URL;
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('Zoho OAuth environment variables not configured');
  }
  return { clientId, clientSecret, callbackUrl };
}

// ── GET /api/auth/zoho/connect ────────────────────────────────────────────────
zohoAuthRouter.get('/connect', (req: Request, res: Response, next): void => {
  const tokenFromQuery = req.query.token as string | undefined;
  if (tokenFromQuery) {
    req.headers.authorization = `Bearer ${tokenFromQuery}`;
  }
  requireAuth(req, res, next);
}, (req: Request, res: Response): void => {
  const { clientId, callbackUrl } = getZohoConfig();
  const state = crypto.randomBytes(32).toString('hex');

  res.cookie(ZOHO_STATE_COOKIE, JSON.stringify({ state, userId: req.userId }), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/zoho',
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: ZOHO_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`);
});

// ── GET /api/auth/zoho/callback ───────────────────────────────────────────────
zohoAuthRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${frontendUrl}/settings?error=missing_params`);
    return;
  }

  const cookieRaw = req.cookies?.[ZOHO_STATE_COOKIE];
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

  res.clearCookie(ZOHO_STATE_COOKIE, { path: '/api/auth/zoho' });

  const { clientId, clientSecret, callbackUrl } = getZohoConfig();
  const userId = cookieData.userId;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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
      logger.error({ tokenData, userId }, 'Zoho token exchange failed');
      res.redirect(`${frontendUrl}/settings?error=token_exchange_failed`);
      return;
    }

    // Fetch user account info (Zoho Accounts API)
    const accountRes = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
    });
    const accountData = (await accountRes.json()) as any;
    
    let email = '';
    let name = '';
    if (accountData?.data && accountData.data.length > 0) {
      email = accountData.data[0].primaryEmailAddress;
      name = accountData.data[0].displayName;
    } else {
      throw new Error('Could not fetch Zoho email account');
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    const updateData: any = {
      provider: 'zoho',
      email,
      name,
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
        provider: 'zoho',
        email,
        name,
        accessTokenEnc: encrypt(tokenData.access_token),
        refreshTokenEnc: encrypt(tokenData.refresh_token || ''),
        expiresAt,
      },
      update: updateData,
    });

    logger.info({ userId, email }, 'Zoho email connected');
    res.redirect(`${frontendUrl}/settings?connected=zoho`);
  } catch (err) {
    logger.error(err, 'Failed to process Zoho callback');
    res.redirect(`${frontendUrl}/settings?error=server_error`);
  }
});
