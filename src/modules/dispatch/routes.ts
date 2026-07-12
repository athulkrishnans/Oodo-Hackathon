// src/modules/dispatch/routes.ts — M3 owns this file
// Driver + trip routes (BUILD_BIBLE Sections 5.1, 6, 7, 8).
// RBAC at the route level: driver writes → SAFETY_OFFICER; trip writes → DISPATCHER.
// NOTE: /trips/recommendations is declared BEFORE /trips/:id so it isn't shadowed by the param route.

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { idempotencyCheck } from '../../middleware/idempotency';
import { successResponse } from '../../shared/types';
import {
  createDriverSchema,
  updateDriverSchema,
  listDriversQuerySchema,
  createTripSchema,
  completeTripSchema,
  listTripsQuerySchema,
  recommendationQuerySchema,
} from '../../shared/zodSchemas';
import { dispatchService } from './service';

export const dispatchRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

const actorId = (res: Response): string => res.locals.user?.sub as string;

const canWriteDrivers = requireRole('SAFETY_OFFICER', 'ADMIN');
const canWriteTrips = requireRole('DISPATCHER', 'ADMIN');

// ── Drivers ─────────────────────────────────
dispatchRouter.get(
  '/drivers',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listDriversQuerySchema.parse(req.query);
    const { items, total } = await dispatchService.listDrivers(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

dispatchRouter.post(
  '/drivers',
  authenticate,
  canWriteDrivers,
  asyncHandler(async (req, res) => {
    const input = createDriverSchema.parse(req.body);
    const driver = await dispatchService.createDriver(input, actorId(res));
    res.status(201).json(successResponse(driver));
  }),
);

dispatchRouter.get(
  '/drivers/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const driver = await dispatchService.getDriver(req.params.id);
    res.status(200).json(successResponse(driver));
  }),
);

dispatchRouter.put(
  '/drivers/:id',
  authenticate,
  canWriteDrivers,
  asyncHandler(async (req, res) => {
    const input = updateDriverSchema.parse(req.body);
    const driver = await dispatchService.updateDriver(req.params.id, input, actorId(res));
    res.status(200).json(successResponse(driver));
  }),
);

// ── Trips ───────────────────────────────────
// Recommendations MUST precede /trips/:id (Section 8).
dispatchRouter.get(
  '/trips/recommendations',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = recommendationQuerySchema.parse(req.query);
    const result = await dispatchService.getRecommendations(query);
    res.status(200).json(successResponse(result));
  }),
);

dispatchRouter.get(
  '/trips',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listTripsQuerySchema.parse(req.query);
    const { items, total } = await dispatchService.listTrips(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

dispatchRouter.post(
  '/trips',
  authenticate,
  canWriteTrips,
  asyncHandler(async (req, res) => {
    const input = createTripSchema.parse(req.body);
    const trip = await dispatchService.createTrip(input, actorId(res));
    res.status(201).json(successResponse(trip));
  }),
);

dispatchRouter.get(
  '/trips/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const trip = await dispatchService.getTrip(req.params.id);
    res.status(200).json(successResponse(trip));
  }),
);

// POST /trips/:id/dispatch — idempotency-guarded core transaction (Section 7).
dispatchRouter.post(
  '/trips/:id/dispatch',
  authenticate,
  canWriteTrips,
  idempotencyCheck,
  asyncHandler(async (req, res) => {
    const key = res.locals.idempotencyKey as string | undefined;
    const trip = await dispatchService.dispatchTrip(req.params.id, key, actorId(res));
    res.status(200).json(successResponse(trip));
  }),
);

dispatchRouter.post(
  '/trips/:id/complete',
  authenticate,
  canWriteTrips,
  asyncHandler(async (req, res) => {
    const input = completeTripSchema.parse(req.body);
    const trip = await dispatchService.completeTrip(req.params.id, input, actorId(res));
    res.status(200).json(successResponse(trip));
  }),
);

dispatchRouter.post(
  '/trips/:id/cancel',
  authenticate,
  canWriteTrips,
  asyncHandler(async (req, res) => {
    const trip = await dispatchService.cancelTrip(req.params.id, actorId(res));
    res.status(200).json(successResponse(trip));
  }),
);
