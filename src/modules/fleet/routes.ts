// src/modules/fleet/routes.ts — M2 owns this file
// Vehicle CRUD — BUILD_BIBLE Section 5.1, Section 6, Section 7 rule 1, Section 12.
// RBAC gate applied at the ROUTE level (conventions.md), never buried in service logic.

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { successResponse } from '../../shared/types';
import {
  createVehicleSchema,
  updateVehicleSchema,
  listVehiclesQuerySchema,
  createMaintenanceSchema,
  closeMaintenanceSchema,
  listMaintenanceQuerySchema,
} from '../../shared/zodSchemas';
import { fleetService } from './service';

export const fleetRouter = Router();

// Forwards async errors to the central error handler (middleware/errors.ts).
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// Writes are restricted to FLEET_MANAGER + ADMIN (Section 3).
const canWriteVehicles = requireRole('FLEET_MANAGER', 'ADMIN');

// actorId always comes from the verified JWT claim, never the request body.
function actorId(res: Response): string {
  return res.locals.user?.sub as string;
}

// GET /api/v1/vehicles — paginated (default 20), filter by type/status/region.
fleetRouter.get(
  '/vehicles',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listVehiclesQuerySchema.parse(req.query);
    const { items, total } = await fleetService.listVehicles(query);
    res.status(200).json(
      successResponse(items, { page: query.page, limit: query.limit, total }),
    );
  }),
);

// POST /api/v1/vehicles — FLEET_MANAGER / ADMIN only. 409 on duplicate registration.
fleetRouter.post(
  '/vehicles',
  authenticate,
  canWriteVehicles,
  asyncHandler(async (req, res) => {
    const input = createVehicleSchema.parse(req.body);
    const vehicle = await fleetService.createVehicle(input, actorId(res));
    res.status(201).json(successResponse(vehicle));
  }),
);

// GET /api/v1/vehicles/:id
fleetRouter.get(
  '/vehicles/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const vehicle = await fleetService.getVehicle(req.params.id);
    res.status(200).json(successResponse(vehicle));
  }),
);

// PATCH /api/v1/vehicles/:id — FLEET_MANAGER / ADMIN only. Rejects ON_TRIP (Section 6).
fleetRouter.patch(
  '/vehicles/:id',
  authenticate,
  canWriteVehicles,
  asyncHandler(async (req, res) => {
    const input = updateVehicleSchema.parse(req.body);
    const vehicle = await fleetService.updateVehicle(req.params.id, input, actorId(res));
    res.status(200).json(successResponse(vehicle));
  }),
);

// POST /api/v1/vehicles/:id/retire — FLEET_MANAGER / ADMIN. Blocked if ON_TRIP or OPEN maintenance.
fleetRouter.post(
  '/vehicles/:id/retire',
  authenticate,
  canWriteVehicles,
  asyncHandler(async (req, res) => {
    const vehicle = await fleetService.retireVehicle(req.params.id, actorId(res));
    res.status(200).json(successResponse(vehicle));
  }),
);

// GET /api/v1/maintenance-logs — paginated, filter by vehicle/status.
fleetRouter.get(
  '/maintenance-logs',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listMaintenanceQuerySchema.parse(req.query);
    const { items, total } = await fleetService.listMaintenance(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

// POST /api/v1/maintenance-logs — Rule #9: opening auto-sets vehicle IN_SHOP.
fleetRouter.post(
  '/maintenance-logs',
  authenticate,
  canWriteVehicles,
  asyncHandler(async (req, res) => {
    const input = createMaintenanceSchema.parse(req.body);
    const log = await fleetService.openMaintenance(input, actorId(res));
    res.status(201).json(successResponse(log));
  }),
);

// POST /api/v1/maintenance-logs/:id/close — Rule #10: closing sets vehicle AVAILABLE unless RETIRED.
fleetRouter.post(
  '/maintenance-logs/:id/close',
  authenticate,
  canWriteVehicles,
  asyncHandler(async (req, res) => {
    const input = closeMaintenanceSchema.parse(req.body);
    const log = await fleetService.closeMaintenance(req.params.id, input, actorId(res));
    res.status(200).json(successResponse(log));
  }),
);
