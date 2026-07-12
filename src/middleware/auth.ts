// middleware/auth.ts
// Verifies JWT Bearer token on every protected request.
// Attaches decoded payload to res.locals.user.
// Implemented by M1 in H1–2.

import { Request, Response, NextFunction } from 'express';

export interface AuthPayload {
  sub: string;   // userId
  role: string;  // Role enum value
  email: string;
  iat: number;
  exp: number;
}

// Stub — replace with real JWT verification in H1-2
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // TODO: verify Authorization: Bearer <jwt>
  // jwt.verify(token, process.env.JWT_SECRET!) → res.locals.user = payload
  // On failure: res.status(401).json({ success: false, error: { code: 'auth/invalid-token', message: 'Invalid or expired token' } })
  next();
}
