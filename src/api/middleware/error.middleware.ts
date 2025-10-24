import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // 예상치 못한 에러
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
