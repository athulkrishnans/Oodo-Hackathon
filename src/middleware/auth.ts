// middleware/auth.ts
// Verifies JWT Bearer token on every protected request.
// Attaches decoded payload to res.locals.user.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errors';
import { Role } from '@prisma/client';

export interface AuthPayload {
  sub: string;        // userId
  role: Role | null;  // null = pending/roleless account — passes authenticate, fails every requireRole
  email: string;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, 'server/misconfigured', 'JWT_SECRET is not set');
  }
  return secret;
}

// Sign a short-lived access token (Section 2 — 15 min default).
export function signAccessToken(payload: { sub: string; role: Role | null; email: string }): string {
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, getSecret(), options);
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'auth/missing-token', 'Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, getSecret()) as AuthPayload;
    res.locals.user = decoded;
    next();
  } catch {
    throw new AppError(401, 'auth/invalid-token', 'Invalid or expired token');
  }
}

// Typed accessor for the authenticated user in route handlers/services.
export function currentUser(res: Response): AuthPayload {
  const user = res.locals.user as AuthPayload | undefined;
  if (!user) {
    throw new AppError(401, 'auth/unauthenticated', 'Not authenticated');
  }
  return user;
}
