// apps/api/src/lib/jwt.ts
// JWT access + refresh token utilities

import jwt from 'jsonwebtoken';

const ACCESS_SECRET = () => {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET not set');
  return s;
};

const REFRESH_SECRET = () => {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET not set');
  return s;
};

export interface AccessTokenPayload {
  userId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId, type: 'access' } satisfies AccessTokenPayload, ACCESS_SECRET(), {
    expiresIn: '15m',
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' } satisfies RefreshTokenPayload, REFRESH_SECRET(), {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET()) as RefreshTokenPayload;
}
