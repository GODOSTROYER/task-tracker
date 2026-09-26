import { NextFunction, Request, Response, RequestHandler } from 'express';
import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';

export class AppError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

export const asyncHandler = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve().then(() => fn(req, res, next)).catch(next);
};

export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err instanceof UniqueConstraintError) return res.status(409).json({ message: 'Resource already exists' });
  if (err instanceof ForeignKeyConstraintError) return res.status(409).json({ message: 'Related resource changed; refresh and retry' });
  if (err instanceof ValidationError) return res.status(400).json({ message: err.errors[0]?.message || 'Validation error' });
  if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  console.error('Unhandled request error:', err);
  return res.status(500).json({ message: 'Server error' });
}
