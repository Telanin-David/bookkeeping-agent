import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // PostgreSQL unique constraint violation
  if (isPostgresError(err) && err.code === '23505') {
    res.status(409).json({ error: 'CONFLICT', message: 'Resource already exists' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
}

function isPostgresError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}
