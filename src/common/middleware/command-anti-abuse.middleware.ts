import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../infrastructure/queue/redis.service';
import { logger } from '../logger';
import { configManager } from '../../config/ConfigManager';

const { rateLimit: rl, system } = configManager.get();

// .env에서 COMMAND_MAX_PER_MINUTE를 가져오거나 API 제한 기본값을 사용
const COMMAND_MAX_PER_MINUTE = rl.apiMax; 
const COMMAND_WINDOW_SECONDS = rl.apiWindowMs / 1000;

function buildCommandKey(req: Request): string {
  const userId = (req as any).user?.userId || 'anon';
  const generalId =
    (req as any).user?.generalId ||
    (req.body && ((req.body as any).general_id || (req.body as any).generalId)) ||
    (req.query && ((req.query as any).general_id || (req.query as any).generalId)) ||
    'none';
  const sessionId =
    (req.body && ((req.body as any).session_id || (req.body as any).sessionId)) ||
    (req.query && ((req.query as any).session_id || (req.query as any).sessionId)) ||
    system.sessionId;
  const endpoint = req.path.replace(/\W+/g, '_');

  return `cmdrate:${sessionId}:${userId}:${generalId}:${endpoint}`;
}

/**
 * 명령 API 남용 방지 미들웨어
 */
export async function commandAntiAbuseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    let client;
    try {
      const service = await RedisService.connect();
      client = service.getClient();
    } catch (e: any) {
      logger.warn('[AntiAbuse] Redis 연결 실패, 명령 제한 비활성화', {
        error: e?.message,
      });
      return next();
    }

    const key = buildCommandKey(req);
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, Math.floor(COMMAND_WINDOW_SECONDS));
    }

    if (count > COMMAND_MAX_PER_MINUTE) {
      const ip = req.ip;
      const userAgent = req.headers['user-agent'] || '';

      logger.warn('[AntiAbuse] 명령 속도 제한 초과', {
        key,
        ip,
        userAgent,
        count,
        windowSeconds: COMMAND_WINDOW_SECONDS,
        maxPerMinute: COMMAND_MAX_PER_MINUTE,
      });

      return res.status(429).json({
        success: false,
        result: false,
        message: '명령 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        reason: 'COMMAND_RATE_LIMIT',
      });
    }

    return next();
  } catch (error: any) {
    logger.error('[AntiAbuse] 명령 남용 방지 미들웨어 오류', {
      error: error?.message,
    });
    return next();
  }
}
