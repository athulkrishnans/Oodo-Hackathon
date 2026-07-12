// middleware/rbac.ts
// Role-based access control — applied at route level, never buried in service logic.
// Usage: router.post('/vehicles', authenticate, requireRole('FLEET_MANAGER', 'ADMIN'), handler)
// Convention: role always read from verified JWT claim, never from request body.
// Implemented by M1 in H1–2.

import { Request, Response, NextFunction } from 'express';

export type Role =
  | 'ADMIN'
  | 'FLEET_MANAGER'
  | 'DISPATCHER'
  | 'SAFETY_OFFICER'
  | 'FINANCIAL_ANALYST';

// Stub — replace with real role check in H1-2
export function requireRole(..._roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // TODO: check res.locals.user.role is in _roles
    // On failure: res.status(403).json({ success: false, error: { code: 'auth/forbidden', message: 'Insufficient role' } })
    next();
  };
}
