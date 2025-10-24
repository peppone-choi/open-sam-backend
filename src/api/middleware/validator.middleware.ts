import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * DTO 검증 미들웨어
 * @param dtoClass - 검증할 DTO 클래스
 * @param source - 검증할 데이터 위치 (body, query, params)
 */
export function validateMiddleware<T extends object>(
  dtoClass: new () => T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // TODO: plainToInstance로 DTO 인스턴스 생성
    // TODO: validate로 검증
    // TODO: 검증 실패 시 400 에러 반환
    // TODO: 검증 성공 시 req[source]에 DTO 주입하고 next()
    
    next();
  };
}
