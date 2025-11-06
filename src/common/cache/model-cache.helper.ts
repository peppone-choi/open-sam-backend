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
const TTL = {
  SESSION: 300,      // 5분
  GENERAL: 60,       // 1분
  CITY: 120,         // 2분
  NATION: 120,       // 2분
};

/**
 * Session 조회 (L1 → L2 → DB)
 */
export async function getSession(sessionId: string) {
  return cacheService.getOrLoad(
    cacheKeys.session(sessionId),
    () => (Session as any).findOne({ session_id: sessionId }).lean(),
    TTL.SESSION
  );
}

/**
 * General 조회 (L1 → L2 → DB)
 */
export async function getGeneral(sessionId: string, generalId: number) {
  return cacheService.getOrLoad(
    cacheKeys.general(sessionId, generalId),
    () => (General as any).findOne({ 
      session_id: sessionId,
      'data.no': generalId 
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
    () => (General as any).findOne({ 
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
    () => (City as any).findOne({ 
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
    () => (Nation as any).findOne({ 
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
  
  // 3. DB 동기화 큐에 추가 (데몬이 처리)
  await addToSyncQueue('session', sessionId, data);
  
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
  
  // 1. Redis(L2)에 저장
  await Promise.all([
    cacheManager.setL2(cacheKeys.general(sessionId, generalId), data, TTL.GENERAL),
    cacheManager.setL2(cacheKeys.generalByNo(sessionId, no), data, TTL.GENERAL),
  ]);
  
  // 2. L1 캐시 업데이트
  await Promise.all([
    cacheManager.setL1(cacheKeys.general(sessionId, generalId), data),
    cacheManager.setL1(cacheKeys.generalByNo(sessionId, no), data),
  ]);

  // 3. 목록 캐시 무효화
  await cacheService.invalidate([`generals:list:${sessionId}`], []);
  
  // 4. DB 동기화 큐에 추가
  await addToSyncQueue('general', `${sessionId}:${generalId}`, {
    session_id: sessionId,
    generalId,
    no,
    ...data
  });
  
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
  await cacheManager.setL2(cacheKeys.city(sessionId, cityId), data, TTL.CITY);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(cacheKeys.city(sessionId, cityId), data);
  
  // 3. 목록 캐시 무효화
  await cacheService.invalidate([`cities:list:${sessionId}`], []);
  
  // 4. DB 동기화 큐에 추가
  await addToSyncQueue('city', `${sessionId}:${cityId}`, {
    session_id: sessionId,
    city: cityId,
    ...data
  });
  
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
  await cacheManager.setL2(cacheKeys.nation(sessionId, nationId), data, TTL.NATION);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(cacheKeys.nation(sessionId, nationId), data);
  
  // 3. 목록 캐시 무효화
  await cacheService.invalidate([`nations:list:${sessionId}`], []);
  
  // 4. DB 동기화 큐에 추가
  await addToSyncQueue('nation', `${sessionId}:${nationId}`, {
    session_id: sessionId,
    nation: nationId,
    ...data
  });
  
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
 * 캐시 무효화 (캐시 업데이트가 어려운 경우에만 사용)
 */
export async function invalidateCache(type: 'session' | 'general' | 'city' | 'nation', sessionId: string, id?: number) {
  const keys: string[] = [];
  
  switch (type) {
    case 'session':
      keys.push(cacheKeys.session(sessionId));
      break;
    case 'general':
      if (id) {
        keys.push(cacheKeys.general(sessionId, id));
        keys.push(cacheKeys.generalByNo(sessionId, id));
      } else {
        // 모든 장수 캐시 무효화
        keys.push(`general:byId:${sessionId}:*`);
        keys.push(`general:byNo:${sessionId}:*`);
      }
      break;
    case 'city':
      if (id) {
        keys.push(cacheKeys.city(sessionId, id));
      } else {
        keys.push(`city:byId:${sessionId}:*`);
      }
      break;
    case 'nation':
      if (id) {
        keys.push(cacheKeys.nation(sessionId, id));
      } else {
        keys.push(`nation:byId:${sessionId}:*`);
      }
      break;
  }
  
  await cacheService.invalidate(keys.filter(k => !k.includes('*')), keys.filter(k => k.includes('*')));
}

