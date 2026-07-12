// src/modules/fleet/routes.ts — M2 owns this file
// Implemented in H1–2. Stub only.
// Routes: /vehicles, /vehicles/:id, /vehicles/:id/retire, /maintenance-logs

import { Router } from 'express';

export const fleetRouter = Router();

// GET /api/v1/vehicles
fleetRouter.get('/vehicles', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/vehicles
fleetRouter.post('/vehicles', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/vehicles/:id
fleetRouter.get('/vehicles/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// PUT /api/v1/vehicles/:id
fleetRouter.put('/vehicles/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/vehicles/:id/retire
fleetRouter.post('/vehicles/:id/retire', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/maintenance-logs
fleetRouter.get('/maintenance-logs', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/maintenance-logs
fleetRouter.post('/maintenance-logs', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/maintenance-logs/:id/close
fleetRouter.post('/maintenance-logs/:id/close', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'fleet/not-implemented', message: 'Not yet implemented' } });
});
