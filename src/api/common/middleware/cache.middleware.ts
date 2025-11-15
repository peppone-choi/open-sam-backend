import { Request, Response, NextFunction } from 'express';

// Lazy-load CacheManager to avoid blocking server startup with Redis connection
let cacheManager: any = null;
function getCacheManager() {
  if (!cacheManager) {
    try {
      const { CacheManager } = require('../../../cache/CacheManager');
      cacheManager = CacheManager.getInstance();
    } catch (error) {
      console.error('Failed to load CacheManager:', error);
      // Return a dummy cache manager that does nothing
      cacheManager = {
        get: async () => null,
        set: async () => {},
        getStats: () => ({})
      };
    }
  }
  return cacheManager;
}

export function cacheMiddleware(ttl: number = 3) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      const manager = getCacheManager();
      
      // FUTURE: L1/L2 캐시 조회
      const cached = await manager.get(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.set('X-Cache', 'MISS');

      // FUTURE: 응답을 캐시에 저장
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        manager.set(cacheKey, data, ttl).catch(console.error);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}
