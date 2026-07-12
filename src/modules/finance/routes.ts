// src/modules/finance/routes.ts — M4 owns this file
// Fuel / expense / reports / emission factors (BUILD_BIBLE Sections 9, 10, 13).
// RBAC: FINANCIAL_ANALYST (+ADMIN) for fuel/expense/revenue writes + reports.
// Emission-factor edits are ADMIN only (Section 3).

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { successResponse } from '../../shared/types';
import {
  createFuelLogSchema,
  reviewFuelLogSchema,
  listFuelLogsQuerySchema,
  createExpenseSchema,
  listExpensesQuerySchema,
  setRevenueSchema,
  updateEmissionFactorSchema,
  reportFilterSchema,
  reportNameEnum,
} from '../../shared/zodSchemas';
import { financeService, objectsToCsv } from './service';

export const financeRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

const actorId = (res: Response): string => res.locals.user?.sub as string;
const canWriteFinance = requireRole('FINANCIAL_ANALYST', 'ADMIN');

// ── Fuel logs ───────────────────────────────
financeRouter.get(
  '/fuel-logs',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listFuelLogsQuerySchema.parse(req.query);
    const { items, total } = await financeService.listFuelLogs(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

financeRouter.post(
  '/fuel-logs',
  authenticate,
  canWriteFinance,
  asyncHandler(async (req, res) => {
    const input = createFuelLogSchema.parse(req.body);
    const log = await financeService.createFuelLog(input, actorId(res));
    res.status(201).json(successResponse(log));
  }),
);

// Anomaly review queue (Section 9). Declared before /fuel-logs/:id-style routes (none here, but explicit).
financeRouter.get(
  '/fuel-logs/anomalies',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listFuelLogsQuerySchema.parse(req.query);
    const { items, total } = await financeService.listAnomalies(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

financeRouter.post(
  '/fuel-logs/:id/review',
  authenticate,
  canWriteFinance,
  asyncHandler(async (req, res) => {
    const { reviewNote } = reviewFuelLogSchema.parse(req.body);
    const log = await financeService.reviewAnomaly(req.params.id, reviewNote, actorId(res));
    res.status(200).json(successResponse(log));
  }),
);

// ── Expenses ────────────────────────────────
financeRouter.get(
  '/expenses',
  authenticate,
  asyncHandler(async (req, res) => {
    const query = listExpensesQuerySchema.parse(req.query);
    const { items, total } = await financeService.listExpenses(query);
    res.status(200).json(successResponse(items, { page: query.page, limit: query.limit, total }));
  }),
);

financeRouter.post(
  '/expenses',
  authenticate,
  canWriteFinance,
  asyncHandler(async (req, res) => {
    const input = createExpenseSchema.parse(req.body);
    const expense = await financeService.createExpense(input, actorId(res));
    res.status(201).json(successResponse(expense));
  }),
);

// ── Trip revenue (analyst-editable, ROI numerator) ──
financeRouter.patch(
  '/trips/:id/revenue',
  authenticate,
  canWriteFinance,
  asyncHandler(async (req, res) => {
    const { revenue } = setRevenueSchema.parse(req.body);
    const result = await financeService.setTripRevenue(req.params.id, revenue, actorId(res));
    res.status(200).json(successResponse(result));
  }),
);

// ── Emission factors (Section 10) ───────────
financeRouter.get(
  '/emission-factors',
  authenticate,
  asyncHandler(async (_req, res) => {
    const factors = await financeService.listEmissionFactors();
    res.status(200).json(successResponse(factors));
  }),
);

financeRouter.put(
  '/emission-factors/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = updateEmissionFactorSchema.parse(req.body);
    const factor = await financeService.updateEmissionFactor(req.params.id, data, actorId(res));
    res.status(200).json(successResponse(factor));
  }),
);

// ── Reports (Section 13) ────────────────────
financeRouter.get(
  '/reports/fuel-efficiency',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.status(200).json(successResponse(await financeService.fuelEfficiencyReport(filter)));
  }),
);

financeRouter.get(
  '/reports/utilization',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.status(200).json(successResponse(await financeService.utilizationReport(filter)));
  }),
);

financeRouter.get(
  '/reports/operational-cost',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.status(200).json(successResponse(await financeService.operationalCostReport(filter)));
  }),
);

financeRouter.get(
  '/reports/roi',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.status(200).json(successResponse(await financeService.roiReport(filter)));
  }),
);

financeRouter.get(
  '/reports/carbon',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = reportFilterSchema.parse(req.query);
    res.status(200).json(successResponse(await financeService.carbonReport(filter)));
  }),
);

// CSV export — streaming endpoint honoring the same filters (Section 13).
financeRouter.get(
  '/reports/:name/export',
  authenticate,
  asyncHandler(async (req, res) => {
    const name = reportNameEnum.parse(req.params.name);
    const filter = reportFilterSchema.parse(req.query);
    const rows = await financeService.reportRows(name, filter);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-report.csv"`);
    if (rows.length === 0) {
      res.status(200).end('');
      return;
    }
    // Stream header + rows line by line.
    const csv = objectsToCsv(rows);
    for (const line of csv.split('\n')) res.write(line + '\n');
    res.end();
  }),
);
