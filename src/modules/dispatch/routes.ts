// src/modules/dispatch/routes.ts — M3 owns this file
// Implemented in H1–2. Stub only.
// Routes: /drivers, /trips, /trips/:id/dispatch, /trips/:id/complete, /trips/:id/cancel
//         /trips/recommendations

import { Router } from 'express';

export const dispatchRouter = Router();

// GET /api/v1/drivers
dispatchRouter.get('/drivers', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/drivers
dispatchRouter.post('/drivers', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/drivers/:id
dispatchRouter.get('/drivers/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// PUT /api/v1/drivers/:id
dispatchRouter.put('/drivers/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/trips
dispatchRouter.get('/trips', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/trips
dispatchRouter.post('/trips', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/trips/:id
dispatchRouter.get('/trips/:id', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/trips/:id/dispatch  (idempotency key + row locks — Section 7)
dispatchRouter.post('/trips/:id/dispatch', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/trips/:id/complete
dispatchRouter.post('/trips/:id/complete', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// POST /api/v1/trips/:id/cancel
dispatchRouter.post('/trips/:id/cancel', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});

// GET /api/v1/trips/recommendations?cargoWeightKg=&plannedDistanceKm=  (Section 8)
dispatchRouter.get('/trips/recommendations', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'dispatch/not-implemented', message: 'Not yet implemented' } });
});
