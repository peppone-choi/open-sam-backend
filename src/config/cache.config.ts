/**
 * 캐시 설정
 * 
 * 데이터 유형별 최적화된 TTL과 캐시 전략을 정의합니다.
 * 
 * TTL 가이드라인:
 * - 자주 변경됨 (전투, 실시간 상태): 짧은 TTL (10-30초)
 * - 일반적 (장수, 도시): 중간 TTL (60-120초)
 * - 드물게 변경 (세션, 시나리오): 긴 TTL (300-600초)
 * - 정적 데이터 (상수, 설정): 매우 긴 TTL (1800초 이상)
 */

// TTL 상수 (초 단위)
export const CACHE_TTL = {
  // 매우 짧음 (실시간 업데이트)
  REALTIME: 3,
  
  // 짧음 (전투, 활성 상태)
  SHORT: 10,
  BATTLE: 15,
  
  // 중간 (장수, 도시, 국가)
  MEDIUM: 60,
  GENERAL: 60,
  CITY: 120,
  NATION: 120,
  
  // 긴 TTL (세션, 목록)
  LONG: 300,
  SESSION: 600,
  LIST: 30,  // 목록은 자주 변경될 수 있으므로 짧게
  
  // 매우 긴 TTL (정적 데이터)
  STATIC: 1800,
  CONFIG: 3600,
  
  // 기본값
  DEFAULT: 360,
} as const;

// 캐시 키 접두사
export const CACHE_PREFIX = {
  // 엔티티
  GENERAL: 'general',
  CITY: 'city',
  NATION: 'nation',
  SESSION: 'session',
  BATTLE: 'battle',
  TROOP: 'troop',
  
  // 목록
  LIST: 'list',
  
  // 관계
  BY_NATION: 'byNation',
  BY_CITY: 'byCity',
  BY_OWNER: 'byOwner',
} as const;

/**
 * 캐시 키 생성 헬퍼
 */
export const CacheKeyBuilder = {
  // 장수 관련
  general: (sessionId: string, generalNo: number) => 
    `${CACHE_PREFIX.GENERAL}:${sessionId}:${generalNo}`,
  
  generalByOwner: (sessionId: string, owner: string) =>
    `${CACHE_PREFIX.GENERAL}:${CACHE_PREFIX.BY_OWNER}:${sessionId}:${owner}`,
  
  generalsByNation: (sessionId: string, nationId: number) =>
    `${CACHE_PREFIX.GENERAL}:${CACHE_PREFIX.LIST}:${CACHE_PREFIX.BY_NATION}:${sessionId}:${nationId}`,
  
  generalsByCity: (sessionId: string, cityId: number) =>
    `${CACHE_PREFIX.GENERAL}:${CACHE_PREFIX.LIST}:${CACHE_PREFIX.BY_CITY}:${sessionId}:${cityId}`,
  
  generalsList: (sessionId: string) =>
    `${CACHE_PREFIX.GENERAL}:${CACHE_PREFIX.LIST}:${sessionId}`,
  
  // 도시 관련
  city: (sessionId: string, cityId: number) =>
    `${CACHE_PREFIX.CITY}:${sessionId}:${cityId}`,
  
  citiesByNation: (sessionId: string, nationId: number) =>
    `${CACHE_PREFIX.CITY}:${CACHE_PREFIX.LIST}:${CACHE_PREFIX.BY_NATION}:${sessionId}:${nationId}`,
  
  citiesList: (sessionId: string) =>
    `${CACHE_PREFIX.CITY}:${CACHE_PREFIX.LIST}:${sessionId}`,
  
  // 국가 관련
  nation: (sessionId: string, nationId: number) =>
    `${CACHE_PREFIX.NATION}:${sessionId}:${nationId}`,
  
  nationsList: (sessionId: string) =>
    `${CACHE_PREFIX.NATION}:${CACHE_PREFIX.LIST}:${sessionId}`,
  
  // 세션 관련
  session: (sessionId: string) =>
    `${CACHE_PREFIX.SESSION}:${sessionId}`,
  
  sessionsList: () =>
    `${CACHE_PREFIX.SESSION}:${CACHE_PREFIX.LIST}`,
  
  // 전투 관련
  battle: (sessionId: string, battleId: string) =>
    `${CACHE_PREFIX.BATTLE}:${sessionId}:${battleId}`,
  
  battlesBySession: (sessionId: string) =>
    `${CACHE_PREFIX.BATTLE}:${CACHE_PREFIX.LIST}:${sessionId}`,
  
  // 부대 관련
  troop: (sessionId: string, troopId: number) =>
    `${CACHE_PREFIX.TROOP}:${sessionId}:${troopId}`,
  
  troopsByNation: (sessionId: string, nationId: number) =>
    `${CACHE_PREFIX.TROOP}:${CACHE_PREFIX.LIST}:${CACHE_PREFIX.BY_NATION}:${sessionId}:${nationId}`,
};

/**
 * 캐시 무효화 패턴
 */
export const CacheInvalidationPatterns = {
  // 특정 세션의 모든 장수 캐시
  allGeneralsInSession: (sessionId: string) =>
    `${CACHE_PREFIX.GENERAL}:*:${sessionId}:*`,
  
  // 특정 국가의 모든 장수 목록
  generalsByNation: (sessionId: string, nationId: number) =>
    `${CACHE_PREFIX.GENERAL}:${CACHE_PREFIX.LIST}:${CACHE_PREFIX.BY_NATION}:${sessionId}:${nationId}`,
  
  // 특정 세션의 모든 도시 캐시
  allCitiesInSession: (sessionId: string) =>
    `${CACHE_PREFIX.CITY}:*:${sessionId}:*`,
  
  // 특정 세션의 모든 국가 캐시
  allNationsInSession: (sessionId: string) =>
    `${CACHE_PREFIX.NATION}:*:${sessionId}:*`,
};

/**
 * 캐시 웜업 우선순위
 * 서버 시작 시 미리 로드할 데이터의 우선순위
 */
export const CACHE_WARMUP_PRIORITY = {
  SESSION: 1,      // 세션 정보 최우선
  NATION: 2,       // 국가 정보
  CITY: 3,         // 도시 정보
  GENERAL_LIST: 4, // 장수 목록
  GENERAL: 5,      // 개별 장수
} as const;

export type CacheTTLType = typeof CACHE_TTL[keyof typeof CACHE_TTL];


