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
 * General 저장/업데이트 (Redis → L1 → DB 즉시)
 * 
 * Redis에 저장하고, 중요 필드(crew, crewtype 등)는 DB에도 즉시 저장합니다.
 * 5초 sync 대기 중 캐시 미스로 인한 데이터 불일치를 방지합니다.
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
  
  // 5. 병사 관련 필드 변경 시에만 DB 즉시 업데이트 (비동기, fire-and-forget)
  // 5초 sync 대기 중 캐시 미스로 인한 데이터 불일치 방지
  // 성능을 위해 await 없이 백그라운드 처리
  const gData = data.data || {};
  const immediateUpdate: any = {};
  
  // 중요 필드만 즉시 DB에 반영 (병사, 자금, 소속)
  // 병사/병종 관련
  if (typeof gData.crew === 'number') immediateUpdate['data.crew'] = gData.crew;
  if (typeof gData.crewtype === 'number') immediateUpdate['data.crewtype'] = gData.crewtype;
  if (typeof gData.train === 'number') immediateUpdate['data.train'] = gData.train;
  if (typeof gData.atmos === 'number') immediateUpdate['data.atmos'] = gData.atmos;
  // 개인 자금
  if (typeof gData.gold === 'number') immediateUpdate['data.gold'] = gData.gold;
  if (typeof gData.rice === 'number') immediateUpdate['data.rice'] = gData.rice;
  // 소속 (귀순, 등용 등)
  if (typeof gData.city === 'number') immediateUpdate['data.city'] = gData.city;
  if (typeof gData.nation === 'number') immediateUpdate['data.nation'] = gData.nation;
  
  if (Object.keys(immediateUpdate).length > 0) {
    // 비동기로 DB 업데이트 (await 없음 - fire-and-forget)
    General.updateOne(
      { session_id: sessionId, no },
      { $set: immediateUpdate },
      { strict: false }
    ).catch(err => {
      logger.warn('General DB 즉시 업데이트 실패', { sessionId, generalId, err: err?.message });
    });
  }
  
  logger.debug('General Redis 저장', { sessionId, generalId });
  
  return data;
}

/**
 * City 저장/업데이트 (Redis → L1 → DB 비동기)
 * 
 * Redis에 저장하고, 인구/자금 관련 필드는 DB에도 비동기 즉시 저장합니다.
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
  
  // 5. 중요 필드는 DB에 비동기 즉시 저장 (중복 사용 방지)
  const immediateUpdate: any = {};
  // 인구/신뢰도
  if (typeof data.pop === 'number') immediateUpdate.pop = data.pop;
  if (typeof data.trust === 'number') immediateUpdate.trust = data.trust;
  // 도시 자금
  if (typeof data.gold === 'number') immediateUpdate.gold = data.gold;
  if (typeof data.rice === 'number') immediateUpdate.rice = data.rice;
  // 소속 국가 (점령 시)
  if (typeof data.nation === 'number') immediateUpdate.nation = data.nation;
  // 이벤트 상태 (재해, 풍년 등 맵 아이콘 표시용)
  if (typeof data.state === 'number') immediateUpdate.state = data.state;
  if (typeof data.term === 'number') immediateUpdate.term = data.term;
  // 내정 관련 필드 (농업/상업/치안/수비/성벽) - 즉시 반영 필요
  if (typeof data.agri === 'number') immediateUpdate.agri = data.agri;
  if (typeof data.comm === 'number') immediateUpdate.comm = data.comm;
  if (typeof data.secu === 'number') immediateUpdate.secu = data.secu;
  if (typeof data.def === 'number') immediateUpdate.def = data.def;
  if (typeof data.wall === 'number') immediateUpdate.wall = data.wall;
  
  if (Object.keys(immediateUpdate).length > 0) {
    // nation 변경(점령)은 동기적으로 처리 - 캐시 미스 시 DB에서 옛날 값 읽는 것 방지
    // 나머지 필드는 비동기로 처리 (성능 유지)
    const hasNationChange = typeof immediateUpdate.nation === 'number';
    
    if (hasNationChange) {
      // Critical: nation 변경은 await로 동기 처리
      try {
        await City.updateOne(
          { session_id: sessionId, city: cityId },
          { $set: immediateUpdate },
          { strict: false }
        );
        logger.debug('City DB 즉시 업데이트 성공 (nation 변경)', { sessionId, cityId, nation: immediateUpdate.nation });
      } catch (err: any) {
        logger.warn('City DB 즉시 업데이트 실패', { sessionId, cityId, err: err?.message });
      }
    } else {
      // 일반 필드는 비동기로 처리 (fire-and-forget)
      City.updateOne(
        { session_id: sessionId, city: cityId },
        { $set: immediateUpdate },
        { strict: false }
      ).catch(err => {
        logger.warn('City DB 비동기 업데이트 실패', { sessionId, cityId, err: err?.message });
      });
    }
  }
  
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
 * Nation 저장/업데이트 (Redis → L1 → DB 비동기)
 * 
 * Redis에 저장하고, 자금 관련 필드는 DB에도 비동기 즉시 저장합니다.
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
  
  // 5. 자금 관련 필드는 DB에 비동기 즉시 저장 (중복 사용 방지)
  const nData = data.data || data;
  const immediateUpdate: any = {};
  if (typeof nData.gold === 'number') immediateUpdate['data.gold'] = nData.gold;
  if (typeof nData.rice === 'number') immediateUpdate['data.rice'] = nData.rice;
  
  if (Object.keys(immediateUpdate).length > 0) {
    Nation.updateOne(
      { session_id: sessionId, nation: nationId },
      { $set: immediateUpdate },
      { strict: false }
    ).catch(err => {
      logger.warn('Nation DB 즉시 업데이트 실패', { sessionId, nationId, err: err?.message });
    });
  }
  
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

/**
 * Troop 저장/업데이트 (Redis → L1 → sync-queue)
 */
export async function saveTroop(sessionId: string, troopId: number, data: any) {
  const key = `troop:${sessionId}:${troopId}`;
  
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(key, data, TTL.MEDIUM);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(key, data);
  
  // 3. DB 동기화 큐에 추가
  await addToSyncQueue('troop', `${sessionId}:${troopId}`, sanitizeForSync(data));
  
  // 4. 목록 캐시 무효화
  await cacheService.invalidate(
    [`troops:list:${sessionId}`, `troops:nation:${sessionId}:${data.nation || data.data?.nation || 0}`],
    []
  );
  
  logger.debug('Troop Redis 저장', { sessionId, troopId });
  return data;
}

/**
 * Diplomacy 저장/업데이트 (Redis → L1 → sync-queue)
 */
export async function saveDiplomacy(sessionId: string, diplomacyId: string, data: any) {
  const key = `diplomacy:${sessionId}:${diplomacyId}`;
  
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(key, data, TTL.MEDIUM);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(key, data);
  
  // 3. DB 동기화 큐에 추가
  await addToSyncQueue('diplomacy', `${sessionId}:${diplomacyId}`, sanitizeForSync(data));
  
  logger.debug('Diplomacy Redis 저장', { sessionId, diplomacyId });
  return data;
}

/**
 * Command (장수 명령) 저장/업데이트 (Redis → L1 → sync-queue)
 */
export async function saveCommand(sessionId: string, generalId: number, turnIdx: number, data: any) {
  const key = `command:${sessionId}:${generalId}:${turnIdx}`;
  
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(key, data, TTL.SHORT);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(key, data);
  
  // 3. DB 동기화 큐에 추가
  await addToSyncQueue('command', `${sessionId}:${generalId}:${turnIdx}`, sanitizeForSync(data));
  
  logger.debug('Command Redis 저장', { sessionId, generalId, turnIdx });
  return data;
}

/**
 * UnitStack 저장/업데이트 - 스택 시스템 제거됨
 * @deprecated 스택 시스템이 제거되어 이 함수는 더 이상 사용되지 않습니다.
 */
export async function saveUnitStack(sessionId: string, stackId: string, data: any) {
  // 스택 시스템 제거됨
  return data;
}

/**
 * Message 저장/업데이트 (Redis → L1 → sync-queue)
 */
export async function saveMessage(sessionId: string, messageId: string, data: any) {
  const key = `message:${sessionId}:${messageId}`;
  
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(key, data, TTL.MEDIUM);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(key, data);
  
  // 3. DB 동기화 큐에 추가
  await addToSyncQueue('message', `${sessionId}:${messageId}`, sanitizeForSync(data));
  
  logger.debug('Message Redis 저장', { sessionId, messageId });
  return data;
}

/**
 * Auction 저장/업데이트 (Redis → L1 → sync-queue)
 */
export async function saveAuction(sessionId: string, auctionId: string, data: any) {
  const key = `auction:${sessionId}:${auctionId}`;
  
  // 1. Redis(L2)에 저장
  await cacheManager.setL2(key, data, TTL.MEDIUM);
  
  // 2. L1 캐시 업데이트
  await cacheManager.setL1(key, data);
  
  // 3. DB 동기화 큐에 추가
  await addToSyncQueue('auction', `${sessionId}:${auctionId}`, sanitizeForSync(data));
  
  logger.debug('Auction Redis 저장', { sessionId, auctionId });
  return data;
}

