import { Request, Response, NextFunction } from 'express';
import { HttpException } from '../errors/HttpException';
import { AppError } from '../errors/app-error';
import { logger } from '../logger';

/**
 * 중앙 집중식 에러 핸들링 미들웨어
 * 
 * 모든 에러를 통일된 형식으로 반환합니다.
 * AppError와 HttpException을 모두 지원하며, 에러 로그를 자동으로 기록합니다.
 * 
 * @param err - 발생한 에러
 * @param req - Express Request
 * @param res - Express Response
 * @param _next - Express NextFunction
 */
export const errorMiddleware = (
  err: Error | HttpException | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId;
  
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // AppError 처리
  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    details = err.meta;
  } 
  // 기존 HttpException 처리
  else if (err instanceof HttpException) {
    status = err.status;
    code = err.code;
    details = err.details;
  }

  // 에러 로깅
  logger.error('애플리케이션 에러', {
    requestId,
    path: req.path,
    method: req.method,
    error: err.message,
    code,
    status,
    stack: err.stack,
    details
  });

  // 응답
  res.status(status).json({
    error: {
      message: err.message || '서버 내부 오류가 발생했습니다',
      code: code || 'INTERNAL_ERROR',
      details,
      requestId,
      path: req.path,
      method: req.method,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
};
