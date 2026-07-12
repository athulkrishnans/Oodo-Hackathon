// middleware/errors.ts
// Central error handler — must be the last app.use() in server.ts.
// Maps known error types to the standard ApiResponse envelope.
// Convention: 500 only for genuinely unexpected errors.

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'validation/schema-error',
        message: 'Validation failed',
        details: err.flatten(),
      },
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unexpected errors → 500 (never for business-rule rejections)
  console.error('[UnhandledError]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'server/internal-error',
      message: 'An unexpected error occurred.',
    },
  });
}
