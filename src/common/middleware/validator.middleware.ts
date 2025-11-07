import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'yup';
import { BadRequestError } from '../errors/app-error';
import { logger } from '../logger';

/**
 * DTO 스키마 인터페이스
 */
interface DtoSchema {
  body?: Schema;
  params?: Schema;
  query?: Schema;
}

/**
 * Yup 기반 검증 미들웨어
 * 
 * 요청 데이터(body, params, query)의 유효성을 검증합니다.
 * 검증 실패 시 400 Bad Request 에러를 반환합니다.
 * 
 * @param schema - 검증할 스키마 객체
 * @returns Express 미들웨어 함수
 * 
 * @example
 * router.post('/', validate(SubmitCommandSchema), controller.submit);
 */
export const validate = (schema: DtoSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Body 검증
      if (schema.body) {
        req.body = await schema.body.validate(req.body, { 
          abortEarly: false,  // 모든 에러 수집
          stripUnknown: true  // 스키마에 없는 필드 제거
        });
      }

      // Params 검증
      if (schema.params) {
        req.params = await schema.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true
        });
      }

      // Query 검증
      if (schema.query) {
        req.query = await schema.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true
        });
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        // Yup ValidationError 처리
        const errors = error.inner.map(err => ({
          path: err.path,
          message: err.message,
          value: err.value
        }));

        logger.warn('요청 데이터 검증 실패', {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          errors
        });

        next(new BadRequestError('요청 데이터가 유효하지 않습니다', { errors }));
      } else {
        // 기타 에러
        logger.error('검증 미들웨어 에러', {
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  };
};
