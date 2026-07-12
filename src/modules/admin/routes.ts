// src/modules/admin/routes.ts — M1 owns this file
// Settings (ADMIN), notifications (any authenticated user, own only),
// audit-log viewer (ADMIN + FLEET_MANAGER), and the manual license-expiry trigger.

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate, currentUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { successResponse } from '../../shared/types';
import {
  updateSettingsSchema,
  listNotificationsQuerySchema,
  listAuditLogsQuerySchema,
} from '../../shared/zodSchemas';
import { adminService } from './service';
import { runLicenseExpiryCheck } from '../../jobs/licenseExpiry';
import { runSimulateDay } from '../../jobs/simulateDay';

export const adminRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// ── Settings (Section 4, ADMIN) ─────────────
adminRouter.get(
  '/settings',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    res.status(200).json(successResponse(await adminService.getSettings()));
  }),
);

adminRouter.put(
  '/settings',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = updateSettingsSchema.parse(req.body);
    const { sub } = currentUser(res);
    res.status(200).json(successResponse(await adminService.updateSettings(input, sub)));
  }),
);

// ── Notifications (Section 11, any authenticated user) ──
adminRouter.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listNotificationsQuerySchema.parse(req.query);
    const { sub } = currentUser(res);
    const { items, total, unreadCount } = await adminService.listNotifications(sub, query);
    res.status(200).json(successResponse({ items, unreadCount }, { page: query.page, limit: query.limit, total }));
  }),
);

adminRouter.patch(
  '/notifications/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sub } = currentUser(res);
    const notification = await adminService.markNotificationRead(req.params.id, sub);
    res.status(200).json(successResponse(notification));
  }),
);

adminRouter.post(
  '/notifications/read-all',
  authenticate,
  asyncHandler(async (_req, res) => {
    const { sub } = currentUser(res);
    res.status(200).json(successResponse(await adminService.markAllNotificationsRead(sub)));
  }),
);

// ── Audit log viewer (Section 14 #8, ADMIN + FLEET_MANAGER) ──
adminRouter.get(
  '/audit-logs',
  authenticate,
  requireRole('ADMIN', 'FLEET_MANAGER'),
  asyncHandler(async (req, res) => {
    const query = listAuditLogsQuerySchema.parse(req.query);
    const { items, total } = await adminService.listAuditLogs(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

// ── Manual license-expiry trigger (Section 11 / Section 14 #5, SAFETY_OFFICER + ADMIN) ──
adminRouter.post(
  '/jobs/license-expiry-check',
  authenticate,
  requireRole('SAFETY_OFFICER', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    res.status(200).json(successResponse(await runLicenseExpiryCheck()));
  }),
);

// ── Simulate Day live demo (Section 12 / Section 14 #4, ADMIN, gated by setting) ──
adminRouter.post(
  '/jobs/simulate-day',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const { sub } = currentUser(res);
    res.status(200).json(successResponse(await runSimulateDay(sub)));
  }),
);
