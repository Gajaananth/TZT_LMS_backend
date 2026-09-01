import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? (err.code || 'APP_ERROR') : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? err.message : 'Internal server error';

  console.error('[ERROR]', {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack,
    code,
    statusCode,
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  });
};
