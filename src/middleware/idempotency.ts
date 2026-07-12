// middleware/idempotency.ts
// Double-click / double-submit guard for the dispatch endpoint.
// Client sends Idempotency-Key header; if key already used, returns the original response.
// Section 7 — idempotencyKey field on Trip model.
// Implemented by M3 in H5–6.

import { Request, Response, NextFunction } from 'express';

// Stub — replace with real idempotency check in H5-6
export function idempotencyCheck(req: Request, _res: Response, next: NextFunction): void {
  // TODO:
  // 1. Read req.headers['idempotency-key']
  // 2. Check trips table for existing row with that idempotencyKey
  // 3. If found and DISPATCHED/COMPLETED → return 200 with that trip (not a duplicate)
  // 4. Otherwise store key with pending status and call next()
  void req;
  next();
}
