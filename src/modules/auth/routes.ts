// src/modules/auth/routes.ts — M1 owns this file
// Implemented in H1–2. Stub only.
// Routes: POST /auth/login, POST /auth/signup, GET /auth/me

import { Router } from 'express';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'auth/not-implemented', message: 'Login not yet implemented' } });
});

// POST /api/v1/auth/signup
authRouter.post('/signup', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'auth/not-implemented', message: 'Signup not yet implemented' } });
});

// GET /api/v1/auth/me (protected)
authRouter.get('/me', (_req, res) => {
  res.status(501).json({ success: false, error: { code: 'auth/not-implemented', message: 'Not yet implemented' } });
});
