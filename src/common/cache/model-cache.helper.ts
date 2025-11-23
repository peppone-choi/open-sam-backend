// @ts-nocheck - Type issues need investigation
import { cacheService } from './cache.service';
import { CacheManager } from '../../cache/CacheManager';
import { Session } from '../../models/session.model';
import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import { logger } from '../logger';
import { addToSyncQueue } from './sync-queue.helper';

const cacheManager = CacheManager.getInstance();

/**
 * Mongoose 내부 필드를 제거하여 sync queue에 안전하게 저장할 수 있는 데이터로 변환
 */
function sanitizeForSync(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const cleaned = { ...data };
  delete cleaned.__v;
  delete cleaned._id;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  
  return cleaned;
}

/**
 * 모델별 캐시 헬퍼
 * 
 * L1 → L2 → DB 순서로 데이터를 조회합니다.
 */

// 캐시 키 생성
const cacheKeys = {
  session: (sessionId: string) => `session:byId:${sessionId}`,
  general: (sessionId: string, generalId: number) => `general:byId:${sessionId}:${generalId}`,
  generalByNo: (sessionId: string, no: number) => `general:byNo:${sessionId}:${no}`,
  city: (sessionId: string, cityId: number) => `city:byId:${sessionId}:${cityId}`,
  nation: (sessionId: string, nationId: number) => `nation:byId:${sessionId}:${nationId}`,
};

// TTL 설정 (초 단위)
// 게임 데이터는 프리로드되고 sync-queue로 업데이트되므로 긴 TTL 사용
const TTL = {
  SESSION: 360,      // 6분
  GENERAL: 360,      // 6분 (장수 데이터는 자주 변경됨)
  CITY: 360,         // 6분
  NATION: 360,       // 6분
};

/**
 * Session 조회 (L1 → L2 → DB)
 */
export async function getSession(sessionId: string) {
  return cacheService.getOrLoad(
    cacheKeys.session(sessionId),
    () => Session.findOne({ session_id: sessionId }).lean(),
    TTL.SESSION
  );
}

/**
 * General 조회 (L1 → L2 → DB)
 */
export async function getGeneral(sessionId: string, generalId: number) {
  return cacheService.getOrLoad(
    cacheKeys.general(sessionId, generalId),
    () => General.findOne({
      session_id: sessionId,
      $or: [
        { 'data.no': generalId },
        { no: generalId },
      ],
    }).lean(),
    TTL.GENERAL
  );
}


/**
 * General 조회 (no 필드로)
 */
export async function getGeneralByNo(sessionId: string, no: number) {
  return cacheService.getOrLoad(
    cacheKeys.generalByNo(sessionId, no),
    () => General.findOne({ 
      session_id: sessionId,
      no: no 
    }).lean(),
    TTL.GENERAL
  );
}

/**
 * City 조회 (L1 → L2 → DB)
 */
export async function getCity(sessionId: string, cityId: number) {
  return cacheService.getOrLoad(
    cacheKeys.city(sessionId, cityId),
    () => City.findOne({ 
      session_id: sessionId,
      city: cityId 
    }).lean(),
    TTL.CITY
  );
}

/**
 * Nation 조회 (L1 → L2 → DB)
 */
export async function getNation(sessionId: string, nationId: number) {
  return cacheService.getOrLoad(
    cacheKeys.nation(sessionId, nationId),
    () => Nation.findOne({ 
      session_id: sessionId,
      nation: nationId 
    }).lean(),
    TTL.NATION
  );
}

/**
 * Session 저장/업데이트 (Redis → L1)
 * 
 * Redis에 먼저 저장하고, 데몬이 주기적으로 DB에 동기화합니다.
 * DB는 영속성만 보장하고, 일반적인 읽기/쓰기는 모두 Redis에서 합니다.
 */
export async function saveSession(sessionId: string, data: any) {
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(cacheKeys.session(sessionId), data, TTL.SESSION);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(cacheKeys.session(sessionId), data);
  
  // 3. DB 동기화 큐에 추가 (데몬이 처리) - Mongoose 내부 필드 제거
  await addToSyncQueue('session', sessionId, sanitizeForSync(data));
  
  logger.debug('Session Redis 저장', { sessionId });
  
  return data;
}

/**
 * General 저장/업데이트 (Redis → L1)
 * 
 * Redis에 먼저 저장하고, 데몬이 주기적으로 DB에 동기화합니다.
 */
export async function saveGeneral(sessionId: string, generalId: number, data: any) {
  const no = data.no || data.data?.no || generalId;
  
  // 1. Redis(L2)에 저장 (파이프라인)
  await cacheManager.setL2Batch([
    { key: cacheKeys.general(sessionId, generalId), value: data, ttl: TTL.GENERAL },
    { key: cacheKeys.generalByNo(sessionId, no), value: data, ttl: TTL.GENERAL },
  ]);
  
  // 2. L1 캐시 업데이트
  await Promise.all([
    cacheManager.setL1(cacheKeys.general(sessionId, generalId), data),
    cacheManager.setL1(cacheKeys.generalByNo(sessionId, no), data),
  ]);


  // 3. 목록 캐시 무효화
  await invalidateCache('general', sessionId, generalId, { targets: ['lists'] });
  
  // 4. DB 동기화 큐에 추가 - Mongoose 내부 필드 제거
  await addToSyncQueue('general', `${sessionId}:${generalId}`, sanitizeForSync(data));
  
  logger.debug('General Redis 저장', { sessionId, generalId });
  
  return data;
}

/**
 * City 저장/업데이트 (Redis → L1)
 * 
 * Redis에 먼저 저장하고, 데몬이 주기적으로 DB에 동기화합니다.
 */
export async function saveCity(sessionId: string, cityId: number, data: any) {
  // 1. Redis(L2)에 저장
  await cacheManager.setL2Batch([
    { key: cacheKeys.city(sessionId, cityId), value: data, ttl: TTL.CITY }
  ]);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(cacheKeys.city(sessionId, cityId), data);

  
  // 3. 목록 캐시 무효화
  await invalidateCache('city', sessionId, cityId, { targets: ['lists'] });
  
  // 4. DB 동기화 큐에 추가 - Mongoose 내부 필드 제거
  await addToSyncQueue('city', `${sessionId}:${cityId}`, sanitizeForSync(data));
  
  logger.debug('City Redis 저장', { sessionId, cityId });
  
  // 실시간 브로드캐스트
  try {
    const { GameEventEmitter } = await import('../../services/gameEventEmitter');
    GameEventEmitter.broadcastCityUpdate(sessionId, cityId, data);
  } catch (error: any) {
    // 브로드캐스트 실패는 무시 (선택적 기능)
    logger.debug('City 브로드캐스트 실패', { error: error.message });
  }
  
  return data;
}

/**
 * Nation 저장/업데이트 (Redis → L1)
 * 
 * Redis에 먼저 저장하고, 데몬이 주기적으로 DB에 동기화합니다.
 */
export async function saveNation(sessionId: string, nationId: number, data: any) {
  // 1. Redis(L2)에 저장
  await cacheManager.setL2Batch([
    { key: cacheKeys.nation(sessionId, nationId), value: data, ttl: TTL.NATION }
  ]);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(cacheKeys.nation(sessionId, nationId), data);

  
  // 3. 목록 캐시 무효화
  await invalidateCache('nation', sessionId, nationId, { targets: ['lists'] });
  
  // 4. DB 동기화 큐에 추가 - Mongoose 내부 필드 제거
  await addToSyncQueue('nation', `${sessionId}:${nationId}`, sanitizeForSync(data));
  
  logger.debug('Nation Redis 저장', { sessionId, nationId });
  
  // 실시간 브로드캐스트
  try {
    const { GameEventEmitter } = await import('../../services/gameEventEmitter');
    GameEventEmitter.broadcastNationUpdate(sessionId, nationId, data);
  } catch (error: any) {
    // 브로드캐스트 실패는 무시 (선택적 기능)
    logger.debug('Nation 브로드캐스트 실패', { error: error.message });
  }
  
  return data;
}

/**
 * 캐시 타깃 종류 (개별 엔티티 vs 목록 뷰)
 */
type CacheTarget = 'entity' | 'lists';

/**
 * 캐시 무효화 (캐시 업데이트가 어려운 경우에만 사용)
 */
export async function invalidateCache(
  type: 'session' | 'general' | 'city' | 'nation',
  sessionId: string,
  id?: number,
  options?: { targets?: CacheTarget[] }
) {
  const targets = options?.targets ?? ['entity', 'lists'];
  const includeEntity = targets.includes('entity');
  const includeLists = targets.includes('lists');

  const keys: string[] = [];
  const patterns: string[] = [];
  
  switch (type) {
    case 'session': {
      if (includeEntity) {
        keys.push(cacheKeys.session(sessionId));
        keys.push(`session:state:${sessionId}`);
      }
      if (includeLists) {
        patterns.push('sessions:*');
      }
      break;
    }
    case 'general': {
      if (includeEntity) {
        if (typeof id === 'number') {
          keys.push(cacheKeys.general(sessionId, id));
          keys.push(cacheKeys.generalByNo(sessionId, id));
        } else {
          patterns.push(`general:byId:${sessionId}:*`);
          patterns.push(`general:byNo:${sessionId}:*`);
        }
      }

      if (includeLists) {
        keys.push(`generals:list:${sessionId}`);
        keys.push(`generals:neutral:${sessionId}`);
        patterns.push(`general:owner:${sessionId}:*`);
        patterns.push(`generals:nation:${sessionId}:*`);
        patterns.push(`generals:city:${sessionId}:*`);
      }

      break;
    }
    case 'city': {
      if (includeEntity) {
        if (typeof id === 'number') {
          keys.push(cacheKeys.city(sessionId, id));
        } else {
          patterns.push(`city:byId:${sessionId}:*`);
        }
      }

      if (includeLists) {
        keys.push(`cities:list:${sessionId}`);
        keys.push(`cities:neutral:${sessionId}`);
        patterns.push(`cities:nation:${sessionId}:*`);
      }

      break;
    }
    case 'nation': {
      if (includeEntity) {
        if (typeof id === 'number') {
          keys.push(cacheKeys.nation(sessionId, id));
        } else {
          patterns.push(`nation:byId:${sessionId}:*`);
        }
      }

      if (includeLists) {
        keys.push(`nations:list:${sessionId}`);
        keys.push(`nations:active:${sessionId}`);
      }

      break;
    }
  }
  
  await cacheService.invalidate(keys, patterns);
}



