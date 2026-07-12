// src/modules/finance/routes.ts — M4 owns this file
// Implemented in H1–2. Stub only.
// Routes: /fuel-logs, /expenses, /reports/*, /emission-factors

import { Router } from 'express';

export const financeRouter = Router();

// GET /api/v1/fuel-logs
financeRouter.get('/fuel-logs', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/fuel-logs
financeRouter.post('/fuel-logs', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/fuel-logs/anomalies
financeRouter.get('/fuel-logs/anomalies', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/fuel-logs/:id/review
financeRouter.post('/fuel-logs/:id/review', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/expenses
financeRouter.get('/expenses', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/expenses
financeRouter.post('/expenses', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/emission-factors
financeRouter.get('/emission-factors', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// PUT /api/v1/emission-factors/:id  (ADMIN only)
financeRouter.put('/emission-factors/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// Reports — Section 13
financeRouter.get('/reports/fuel-efficiency', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

financeRouter.get('/reports/utilization', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

financeRouter.get('/reports/operational-cost', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

financeRouter.get('/reports/roi', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

financeRouter.get('/reports/carbon', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});

// CSV export per report — streaming endpoint
financeRouter.get('/reports/:name/export', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'finance/not-implemented', message: 'Not yet implemented' } });
});
