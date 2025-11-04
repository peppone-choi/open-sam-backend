/**
 * APIHelper - API 헬퍼 (Express.js 통합)
 */

import { Request, Response } from 'express';
import { BaseAPI } from './BaseAPI';
import { Session } from '../utils/Session';
import { DummySession } from '../utils/DummySession';
import { Json } from '../utils/Json';

export enum APIRecoveryType {
  Login = 'Login',
  Gateway = 'Gateway',
}

export class APIHelper {
  private constructor() {
    // static only
  }

  /**
   * 세션 가져오기 (Express Request 기반)
   */
  static getSession(req: Request, sessionMode: number): Session | DummySession | APIRecoveryType {
    if (sessionMode === BaseAPI.NO_SESSION) {
      return DummySession.getInstance();
    }

    const session = Session.getInstance(req);

    if (sessionMode & BaseAPI.REQ_LOGIN || sessionMode & BaseAPI.REQ_GAME_LOGIN) {
      if (!session.isLoggedIn()) {
        return APIRecoveryType.Login;
      }
    }

    if (sessionMode & BaseAPI.REQ_GAME_LOGIN) {
      if (!session.isGameLoggedIn()) {
        const result: { value: boolean } = { value: false };
        session.loginGame(result);
        if (!result.value) {
          return APIRecoveryType.Gateway;
        }
      }
    }

    if (sessionMode & BaseAPI.REQ_READ_ONLY) {
      session.setReadOnly();
    }

    return session;
  }

  /**
   * API 실행 (Express 미들웨어 형태)
   */
  static async launch(
    req: Request,
    res: Response,
    apiClass: new (rootPath: string, args: Record<string, any>) => BaseAPI,
    sessionMode?: number
  ): Promise<void> {
    try {
      // API 인스턴스 생성 (세션 모드를 확인하기 위해)
      const rootPath = process.cwd();
      const args = { ...req.body, ...req.query, ...req.params };
      const api = new apiClass(rootPath, args);
      
      // 세션 모드가 제공되지 않았으면 API 인스턴스에서 가져오기
      if (sessionMode === undefined) {
        sessionMode = api.getRequiredSessionMode();
      }
      
      // 세션 확인
      const sessionResult = APIHelper.getSession(req, sessionMode);
      
      if (sessionResult === APIRecoveryType.Login) {
        res.status(401).json({
          result: false,
          reason: '로그인이 필요합니다.',
        });
        return;
      }

      if (sessionResult === APIRecoveryType.Gateway) {
        res.status(403).json({
          result: false,
          reason: '게임 로그인이 필요합니다.',
        });
        return;
      }

      const session = sessionResult as Session | DummySession;

      // 외부 API 허용 확인 (정적 속성은 생성자 함수에서 접근)
      const apiConstructor = apiClass as typeof BaseAPI & (new (rootPath: string, args: Record<string, any>) => BaseAPI);
      if (apiConstructor.allowExternalAPI === false) {
        // TODO: 외부 IP 체크 로직
      }

      // 인자 검증
      const validateResult = api.validateArgs();
      if (validateResult !== null) {
        res.status(400).json({
          result: false,
          reason: validateResult,
        });
        return;
      }

      // 캐시 확인
      const cacheResult = api.tryCache();
      if (cacheResult) {
        const etag = req.headers['if-none-match'];
        const modifiedSince = req.headers['if-modified-since'];
        
        if (cacheResult.etag && etag && cacheResult.etag === etag) {
          res.status(304).end();
          return;
        }

        if (cacheResult.lastModified && modifiedSince) {
          const cacheDate = new Date(cacheResult.lastModified);
          const reqDate = new Date(modifiedSince.toString());
          if (cacheDate <= reqDate) {
            res.status(304).end();
            return;
          }
        }
      }

      // API 실행
      const modifiedSince = req.headers['if-modified-since']
        ? new Date(req.headers['if-modified-since'].toString())
        : null;
      const reqEtag = req.headers['if-none-match']?.toString() || null;

      // launch가 Promise를 반환할 수도 있고 동기적으로 반환할 수도 있음
      let result: any;
      const launchResult = api.launch(session, modifiedSince, reqEtag);
      if (launchResult instanceof Promise) {
        result = await launchResult;
      } else {
        result = launchResult;
      }

      // 캐시 헤더 설정
      if (cacheResult) {
        const { WebUtil } = await import('../utils/WebUtil');
        WebUtil.setCacheHeader(res, cacheResult);
      }

      // 결과 반환
      if (typeof result === 'string') {
        res.send(result);
        return;
      }

      if (Array.isArray(result) || typeof result === 'object') {
        res.json(result);
        return;
      }

      res.json({ result: true });
    } catch (error: any) {
      res.status(500).json({
        result: false,
        reason: error.message || 'Internal server error',
      });
    }
  }
}

