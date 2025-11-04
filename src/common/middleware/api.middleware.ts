/**
 * API 미들웨어 - BaseAPI를 Express 라우터와 통합
 */

import { Request, Response, NextFunction } from 'express';
import { BaseAPI } from '../BaseAPI';
import { APIHelper } from '../APIHelper';

/**
 * BaseAPI를 Express 미들웨어로 변환
 */
export function createAPIMiddleware(
  apiClass: new (rootPath: string, args: Record<string, any>) => BaseAPI
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // APIHelper.launch에서 세션 모드를 자동으로 결정하므로 전달하지 않음
      await APIHelper.launch(req, res, apiClass);
    } catch (error: any) {
      return res.status(500).json({
        result: false,
        reason: error.message || '서버 오류가 발생했습니다.',
      });
    }
  };
}

/**
 * API 라우트 핸들러 생성
 * 추상 클래스 BaseAPI를 받아서 미들웨어를 생성합니다.
 */
export function createAPIHandler(
  apiClass: typeof BaseAPI & (new (rootPath: string, args: Record<string, any>) => BaseAPI)
) {
  return createAPIMiddleware(apiClass);
}



