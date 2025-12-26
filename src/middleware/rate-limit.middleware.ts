import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { configManager } from '../config/ConfigManager';

const { rateLimit: rl } = configManager.get();

/**
 * Global rate limiter - 모든 요청에 적용
 */
export const globalLimiter = rateLimit({
  windowMs: rl.globalWindowMs,
  max: rl.globalMax,
  message: {
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: `${rl.globalWindowMs / 60000}분`
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: `${rl.globalWindowMs / 60000}분`
    });
  }
});

/**
 * Auth rate limiter - 로그인/회원가입 보호
 */
export const authLimiter = rateLimit({
  windowMs: rl.authWindowMs,
  max: process.env.NODE_ENV === 'development' ? 1000 : rl.authMax, // 개발 환경에서는 무제한 가깝게
  message: {
    error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: `${rl.authWindowMs / 60000}분`
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: `${rl.authWindowMs / 60000}분`
    });
  }
});

/**
 * API rate limiter - 일반 API 보호
 */
export const apiLimiter = rateLimit({
  windowMs: rl.apiWindowMs,
  max: rl.apiMax,
  message: {
    error: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: `${rl.apiWindowMs / 60000}분`
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: `${rl.apiWindowMs / 60000}분`
    });
  }
});

/**
 * Battle rate limiter - 실시간 전투 명령 보호
 */
export const battleLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: {
    error: '전투 명령 요청이 너무 많습니다.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: '전투 명령 요청이 너무 많습니다.',
      retryAfter: '1분'
    });
  }
});

/**
 * General rate limiter - 일반 게임 명령 보호
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: {
    error: '명령 요청이 너무 많습니다.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: '명령 요청이 너무 많습니다.',
      retryAfter: '1분'
    });
  }
});
