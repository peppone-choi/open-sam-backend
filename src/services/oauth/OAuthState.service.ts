import crypto from 'crypto';
import { cacheManager } from '../../cache/CacheManager';
import { ApiError } from '../../errors/ApiError';

const DEFAULT_TTL = parseInt(process.env.OAUTH_STATE_TTL || '600', 10);

export class OAuthStateService {
  static async issueState(meta?: Record<string, unknown>) {
    const state = crypto.randomBytes(16).toString('hex');
    await cacheManager.set(`oauth:state:${state}`, {
      ...meta,
      createdAt: Date.now()
    }, DEFAULT_TTL);

    return state;
  }

  static async consumeState(state: string) {
    const key = `oauth:state:${state}`;
    const payload = await cacheManager.get<Record<string, unknown>>(key);

    if (!payload) {
      throw new ApiError(400, '유효하지 않거나 만료된 OAuth 상태 토큰입니다');
    }

    await cacheManager.delete(key);
    return payload;
  }
}
