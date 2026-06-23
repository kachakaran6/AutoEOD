// apps/api/src/routes/auth.ts
// POST /api/auth/signup, /login, /refresh, /logout

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { logger } from '../lib/logger';

export const authRouter = Router();

const BCRYPT_COST = 12;
const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Must be true for SameSite=none
  sameSite: 'none' as const, // Required for cross-domain frontend/backend
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

// ── Schemas ──────────────────────────────────────────────────────────────────
const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const parse = SignupSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }
  const { name, email, password } = parse.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      settings: { create: {} }, // default UserSettings
    },
  });

  logger.info({ userId: user.id }, 'New user signed up');

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(201).json({ accessToken, user: { id: user.id, name: user.name, email: user.email } });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
    return;
  }
  const { email, password } = parse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  logger.info({ userId: user.id }, 'User logged in');

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email } });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const accessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE, newRefreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, user });
  } catch {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ message: 'Logged out' });
});
