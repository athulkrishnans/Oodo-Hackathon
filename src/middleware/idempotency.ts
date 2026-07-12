// middleware/idempotency.ts
// Double-click / double-submit guard for the dispatch endpoint.
// Client sends an `Idempotency-Key` header. This middleware surfaces it on
// res.locals.idempotencyKey; the dispatch transaction (Section 7) uses the
// unique Trip.idempotencyKey column to return the existing trip instead of
// creating a duplicate — the real dedup is transactional, not in-memory.

import { Request, Response, NextFunction } from 'express';

export function idempotencyCheck(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['idempotency-key'];
  if (typeof key === 'string' && key.trim().length > 0) {
    res.locals.idempotencyKey = key.trim();
  }
  next();
}
