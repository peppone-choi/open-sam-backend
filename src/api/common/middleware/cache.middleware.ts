import { Request, Response, NextFunction } from 'express';
import { CacheManager } from '../../../infrastructure/cache/cache-manager';

const cacheManager = new CacheManager();

export function cacheMiddleware(ttl: number = 3) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      // TODO: L1/L2 캐시 조회
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.set('X-Cache', 'MISS');

      // TODO: 응답을 캐시에 저장
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        cacheManager.set(cacheKey, data, ttl).catch(console.error);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}
