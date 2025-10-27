import { Request, Response, NextFunction } from 'express';
import { HttpException } from '../errors/HttpException';

/**
 * 중앙 집중식 에러 핸들링 미들웨어
 * 모든 에러를 통일된 형식으로 반환
 */
export const errorMiddleware = (
  err: Error | HttpException,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // TODO: 로깅 추가 (winston, pino 등)
  
  const status = err instanceof HttpException ? err.status : 500;
  const code = err instanceof HttpException ? err.code : 'INTERNAL_ERROR';
  const details = err instanceof HttpException ? err.details : undefined;

  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      code: code || 'INTERNAL_ERROR',
      details
    }
  });
};
