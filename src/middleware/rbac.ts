// middleware/rbac.ts
// Role-based access control — applied at route level, never buried in service logic.
// Usage: router.post('/vehicles', authenticate, requireRole('FLEET_MANAGER', 'ADMIN'), handler)
// Convention: role always read from verified JWT claim, never from request body.

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';
import { AuthPayload } from './auth';

export type Role =
  | 'ADMIN'
  | 'FLEET_MANAGER'
  | 'DISPATCHER'
  | 'SAFETY_OFFICER'
  | 'FINANCIAL_ANALYST';

export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.user as AuthPayload | undefined;
    if (!user) {
      throw new AppError(401, 'auth/unauthenticated', 'Not authenticated');
    }
    if (!roles.includes(user.role as Role)) {
      throw new AppError(
        403,
        'auth/forbidden',
        `This action requires one of: ${roles.join(', ')}`,
      );
    }
    next();
  };
}
