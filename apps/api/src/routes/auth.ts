import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import {
  logger,
  AuditService,
  SecurityService,
  EventTaxonomy,
  updateObservabilityContext,
} from '../lib/observability';

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
    await SecurityService.recordEvent({
      eventType: EventTaxonomy.AUTH.SIGNUP_FAILED,
      severity: 'LOW',
      userEmail: email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      route: '/api/auth/signup',
      details: { reason: 'email_already_registered' },
    });
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

  updateObservabilityContext({ userId: user.id, userEmail: user.email, userRole: user.role });
  logger.info({ userId: user.id }, 'New user signed up');

  await AuditService.recordEvent({
    action: EventTaxonomy.AUTH.SIGNUP_SUCCESS,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    category: 'auth',
    resource: 'user',
    resourceId: user.id,
    details: { name: user.name, email: user.email },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(201).json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
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
    await SecurityService.recordEvent({
      eventType: EventTaxonomy.AUTH.LOGIN_FAILED,
      severity: 'LOW',
      userEmail: email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      route: '/api/auth/login',
      details: { reason: 'user_not_found' },
    });
    await SecurityService.checkAndFlagBruteForce(req.ip, email);

    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await SecurityService.recordEvent({
      eventType: EventTaxonomy.AUTH.LOGIN_FAILED,
      severity: 'MEDIUM',
      userId: user.id,
      userEmail: email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      route: '/api/auth/login',
      details: { reason: 'invalid_password' },
    });
    await SecurityService.checkAndFlagBruteForce(req.ip, email);

    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  updateObservabilityContext({ userId: user.id, userEmail: user.email, userRole: user.role });
  logger.info({ userId: user.id }, 'User logged in successfully');

  await AuditService.recordEvent({
    action: EventTaxonomy.AUTH.LOGIN_SUCCESS,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    category: 'auth',
    resource: 'user',
    resourceId: user.id,
    details: { email: user.email, role: user.role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
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
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    updateObservabilityContext({ userId: user.id, userEmail: user.email, userRole: user.role });

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
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  if (req.userId) {
    await AuditService.recordEvent({
      action: EventTaxonomy.AUTH.LOGOUT,
      actorId: req.userId,
      category: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
  res.json({ message: 'Logged out' });
});

