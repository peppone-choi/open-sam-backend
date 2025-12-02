import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const RATE_LIMIT_GLOBAL_WINDOW_MS = parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || String(15 * 60 * 1000), 10);
const RATE_LIMIT_GLOBAL_MAX = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '1000', 10);
const RATE_LIMIT_AUTH_WINDOW_MS = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || String(15 * 60 * 1000), 10);
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10);
const RATE_LIMIT_API_WINDOW_MS = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || String(15 * 60 * 1000), 10);
const RATE_LIMIT_API_MAX = parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10);

// Battle: High frequency (Polling, RTS actions)
const RATE_LIMIT_BATTLE_WINDOW_MS = 1 * 60 * 1000; // 1 minute
const RATE_LIMIT_BATTLE_MAX = 120; // 2 requests per second average

// General: Moderate frequency
const RATE_LIMIT_GENERAL_WINDOW_MS = 1 * 60 * 1000; // 1 minute
const RATE_LIMIT_GENERAL_MAX = 60; // 1 request per second average

/**
 * Global rate limiter - applies to all requests
 * Allows 1000 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_GLOBAL_WINDOW_MS, // default 15 minutes
  max: RATE_LIMIT_GLOBAL_MAX, // default 1000 requests per windowMs
  message: {
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '15분'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: '15분'
    });
  }
});

/**
 * Auth rate limiter - applies to login/register endpoints
 * Allows 5 requests per 15 minutes per IP to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS, // default 15 minutes
  max: RATE_LIMIT_AUTH_MAX, // default 5 requests per windowMs
  message: {
    error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
    retryAfter: '15분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
      retryAfter: '15분'
    });
  }
});

/**
 * API rate limiter - applies to general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_API_WINDOW_MS, // default 15 minutes
  max: RATE_LIMIT_API_MAX, // default 100 requests per windowMs
  message: {
    error: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '15분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter: '15분'
    });
  }
});

/**
 * Battle rate limiter - applies to RTS battle endpoints
 * Allows 120 requests per 1 minute per IP
 */
export const battleLimiter = rateLimit({
  windowMs: RATE_LIMIT_BATTLE_WINDOW_MS,
  max: RATE_LIMIT_BATTLE_MAX,
  message: {
    error: '전투 명령 요청이 너무 많습니다.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: '전투 명령 요청이 너무 많습니다.',
      retryAfter: '1분'
    });
  }
});

/**
 * General rate limiter - applies to General command endpoints
 * Allows 60 requests per 1 minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_GENERAL_WINDOW_MS,
  max: RATE_LIMIT_GENERAL_MAX,
  message: {
    error: '명령 요청이 너무 많습니다.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: '명령 요청이 너무 많습니다.',
      retryAfter: '1분'
    });
  }
});
