// src/modules/auth/routes.ts — M1 owns this file
// Auth routes (Section 3). Mounted at /api/v1/auth (with authRateLimit) in server.ts.
// User-management routes live on usersRouter, mounted at /api/v1 (ADMIN only).

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, currentUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { successResponse } from '../../shared/types';
import {
  loginSchema,
  signupSchema,
  assignRoleSchema,
  updateUserStatusSchema,
  paginationQuerySchema,
} from '../../shared/zodSchemas';
import { authService } from './service';

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// ── /api/v1/auth ──────────────────────────────
export const authRouter = Router();

// POST /api/v1/auth/signup — creates a roleless, pending ACTIVE account.
authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const user = await authService.signup(input);
    res.status(201).json(successResponse(user));
  }),
);

// POST /api/v1/auth/login — returns { accessToken, user }.
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(successResponse(result));
  }),
);

// GET /api/v1/auth/me — current user (fresh from DB).
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (_req, res) => {
    const { sub } = currentUser(res);
    const user = await authService.me(sub);
    res.status(200).json(successResponse(user));
  }),
);

// ── /api/v1/users (ADMIN user management) ─────
export const usersRouter = Router();

// GET /api/v1/users — paginated list of all accounts.
usersRouter.get(
  '/users',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const query = paginationQuerySchema.parse(req.query);
    const { items, total } = await authService.listUsers(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

// PATCH /api/v1/users/:id/role — assign a role (approves pending accounts).
usersRouter.patch(
  '/users/:id/role',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { role } = assignRoleSchema.parse(req.body);
    const { sub } = currentUser(res);
    const user = await authService.assignRole(sub, req.params.id, role);
    res.status(200).json(successResponse(user));
  }),
);

// PATCH /api/v1/users/:id/status — activate / deactivate an account.
usersRouter.patch(
  '/users/:id/status',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { status } = updateUserStatusSchema.parse(req.body);
    const { sub } = currentUser(res);
    const user = await authService.setUserStatus(sub, req.params.id, status);
    res.status(200).json(successResponse(user));
  }),
);
