// middleware/rateLimit.ts
// Rate limiting for /auth/* routes: 10 req/min/IP (Section 3 — blocks credential stuffing).
// Implemented by M1 in H1–2.

import rateLimit from 'express-rate-limit';

// Applied only to /api/v1/auth/* in server.ts
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'auth/rate-limit-exceeded',
      message: 'Too many requests — try again in a minute.',
    },
  },
});
