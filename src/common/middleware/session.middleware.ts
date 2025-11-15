/**
 * Session 미들웨어 - express-session과 통합
 * NOTE: express-session이 설치되어 있으면 사용, 없으면 기본 Session 사용
 */

import { Request, Response, NextFunction } from 'express';
import { Session } from '../../utils/Session';

// express-session 사용 가능 여부 확인
let useExpressSession = false;
let sessionModule: any = null;
try {
  sessionModule = require('express-session');
  useExpressSession = true;
} catch {
  // express-session이 설치되지 않음
}

/**
 * Session 미들웨어 설정
 */
export function setupSessionMiddleware() {
  if (useExpressSession && sessionModule) {
    // express-session 미들웨어 반환
    return sessionModule({
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24시간
        sameSite: 'lax' as const,
      },
      // FUTURE: Redis나 MongoDB를 세션 저장소로 사용 가능
      // store: new RedisStore({ client: redisClient })
    });
  }
  
  // express-session이 없으면 빈 미들웨어 (기본 Session 사용)
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      req.session = {} as any;
    }
    next();
  };
}

/**
 * Session 인스턴스를 Request에 추가하는 미들웨어
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Session 인스턴스를 req에 추가
  req.sessionInstance = Session.getInstance(req);
  next();
}

