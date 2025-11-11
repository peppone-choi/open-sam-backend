import { CacheManager } from '../../cache/CacheManager';
import { logger } from '../logger';

const cacheManager = CacheManager.getInstance();

/**
 * DB 동기화 큐
 * 
 * CQRS 패턴:
 * - Command: Redis에만 쓰기 (sync:queue에 추가)
 * - Query: L1 → L2 → DB 순서로 읽기
 * - Sync Daemon: 주기적으로 Redis → DB 동기화
 */
const SYNC_QUEUE_KEY = 'sync:queue';

/**
 * 동기화 큐에 추가
 */
export async function addToSyncQueue(
  type: 'session' | 'general' | 'city' | 'nation',
  id: string,
  data: any
): Promise<void> {
  try {
    const queueItem = {
      type,
      id,
      data,
      timestamp: Date.now(),
    };
    
    // Redis에 큐 아이템 저장
    await cacheManager.setL2(
      `${SYNC_QUEUE_KEY}:${type}:${id}`,
      queueItem,
      86400 // 24시간 TTL
    );
  } catch (error: any) {
    // 큐 추가 실패해도 Redis 저장은 성공했으므로 계속 진행
    logger.error('동기화 큐 추가 실패', {
      type,
      id,
      message: error?.message,
      stack: error?.stack
    });
  }
}

/**
 * 동기화 큐에서 모든 항목 스캔 (데몬용)
 * Redis SCAN을 사용하여 패턴 매칭
 */
export async function scanSyncQueue(
  pattern: string = `${SYNC_QUEUE_KEY}:*:*`
): Promise<Array<{ type: string; id: string; key: string }>> {
  try {
    const items: Array<{ type: string; id: string; key: string }> = [];
    
    // CacheManager의 scan 메서드 사용
    const keys = await cacheManager.scan(pattern);
    
    for (const key of keys) {
      // sync:queue:type:id 형식에서 type과 id 추출
      const parts = key.split(':');
      if (parts.length >= 4) {
        const type = parts[2];
        const id = parts.slice(3).join(':');
        items.push({ type, id, key });
      }
    }
    
    return items;
  } catch (error: any) {
    logger.error('동기화 큐 스캔 실패', {
      pattern,
      message: error?.message,
      stack: error?.stack
    });
    return [];
  }
}

/**
 * 동기화 큐 아이템 조회
 */
export async function getSyncQueueItem(key: string): Promise<any | null> {
  try {
    return await cacheManager.getL2(key);
  } catch (error: any) {
    logger.error('동기화 큐 아이템 조회 실패', {
      key,
      message: error?.message,
      stack: error?.stack
    });
    return null;
  }
}

/**
 * 동기화 완료 후 큐에서 제거 (데몬용)
 */
export async function removeFromSyncQueue(key: string): Promise<void> {
  try {
    await cacheManager.delete(key);
  } catch (error: any) {
    logger.error('동기화 큐 제거 실패', {
      key,
      message: error?.message,
      stack: error?.stack
    });
  }
}
