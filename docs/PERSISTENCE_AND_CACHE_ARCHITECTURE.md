# 영속성, 캐시, 분산 락 아키텍처

## 목차
1. [개요](#개요)
2. [L1/L2 캐시 구조](#l1l2-캐시-구조)
3. [Redis 분산 락](#redis-분산-락)
4. [MongoDB 트랜잭션](#mongodb-트랜잭션)
5. [데몬별 적용 전략](#데몬별-적용-전략)
6. [장애 대응](#장애-대응)

---

## 개요

다중 세션·다중 데몬 환경에서 **일관된 상태 보장**을 위한 3계층 영속성 아키텍처:

```
┌─────────────┐
│   L1 Cache  │  ← 메모리 (3초 TTL, 프로세스별 로컬)
│  (Node.js)  │
└──────┬──────┘
       ↓
┌─────────────┐
│   L2 Cache  │  ← Redis (360초 TTL, 전역 공유)
│   (Redis)   │
└──────┬──────┘
       ↓
┌─────────────┐
│  Database   │  ← MongoDB (영속성 보장)
│  (MongoDB)  │
└─────────────┘
```

### 핵심 원칙
1. **읽기**: L1 → L2 → DB 순서로 조회 (캐시 히트율 최대화)
2. **쓰기**: Redis → L1 업데이트 → DB 동기화 큐 (비동기)
3. **락**: Redis 분산 락으로 동시성 제어
4. **트랜잭션**: MongoDB 트랜잭션으로 복합 연산 원자성 보장

---

## L1/L2 캐시 구조

### 캐시 계층별 특성

| 계층 | 저장소 | TTL | 범위 | 용도 |
|------|--------|-----|------|------|
| **L1** | Node.js 메모리 | 3초 | 프로세스 로컬 | 초고속 읽기 (동일 요청 반복 시) |
| **L2** | Redis | 360초 | 전역 공유 | 프로세스 간 공유, DB 부하 감소 |
| **DB** | MongoDB | 영구 | 전역 | 영속성, 복구, 분석 |

### 캐시 키 명명 규칙

**파일**: `open-sam-backend/src/common/cache/model-cache.helper.ts:34-41`

```typescript
const cacheKeys = {
  session: (sessionId: string) => `session:byId:${sessionId}`,
  general: (sessionId: string, generalId: number) => `general:byId:${sessionId}:${generalId}`,
  generalByNo: (sessionId: string, no: number) => `general:byNo:${sessionId}:${no}`,
  city: (sessionId: string, cityId: number) => `city:byId:${sessionId}:${cityId}`,
  nation: (sessionId: string, nationId: number) => `nation:byId:${sessionId}:${nationId}`,
};
```

**패턴**:
- 개별 엔티티: `{model}:byId:{sessionId}:{entityId}`
- 목록 캐시: `{model}s:list:{sessionId}`
- 필터 캐시: `{model}s:{filter}:{sessionId}:{param}`

### TTL 설정

**파일**: `open-sam-backend/src/common/cache/model-cache.helper.ts:43-50`

```typescript
const TTL = {
  SESSION: 360,   // 6분 (세션 정보는 덜 자주 변경)
  GENERAL: 360,   // 6분 (장수 데이터는 자주 변경)
  CITY: 360,      // 6분 (도시 데이터)
  NATION: 360,    // 6분 (국가 데이터)
};
```

**TTL 선정 기준**:
- 360초 (6분): 턴 주기(60초)의 6배, 캐시 히트율과 데이터 신선도 균형
- L1 3초: 단일 요청 내 반복 조회 최적화 (예: 한 턴 처리 중 같은 장수 여러 번 조회)

### 캐시 무효화 전략

**파일**: `open-sam-backend/src/common/cache/model-cache.helper.ts:246-335`

#### 무효화 타이밍
1. **즉시 무효화** (업데이트 시):
   - 개별 엔티티 캐시: `session:byId:abc123`
   - 관련 목록 캐시: `generals:list:abc123`

2. **패턴 매칭 무효화** (대량 업데이트 시):
   - `general:byId:${sessionId}:*` (세션 내 모든 장수)
   - `cities:nation:${sessionId}:${nationId}` (국가 내 모든 도시)

#### 무효화 대상 선택

```typescript
export async function invalidateCache(
  type: 'session' | 'general' | 'city' | 'nation',
  sessionId: string,
  id?: number,
  options?: { targets?: CacheTarget[] } // 'entity' | 'lists'
)
```

**사용 예시**:
```typescript
// 장수 업데이트 시 → 개별 캐시만 무효화
await invalidateCache('general', sessionId, generalId, { targets: ['entity'] });

// 국가 멸망 시 → 목록 캐시도 무효화
await invalidateCache('nation', sessionId, nationId, { targets: ['entity', 'lists'] });
```

### getOrLoad 패턴

**파일**: `open-sam-backend/src/common/cache/cache.service.ts:31-83`

```typescript
async getOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttl: number = 360
): Promise<T | null> {
  // 1. L1 캐시 조회
  const l1Data = await cacheManager.getL1<T>(key);
  if (l1Data !== null) return l1Data;

  // 2. L2 캐시 조회
  const l2Data = await cacheManager.getL2<T>(key);
  if (l2Data !== null) {
    await cacheManager.setL1(key, l2Data); // L1 워밍업
    return l2Data;
  }

  // 3. DB 조회
  const data = await loader();
  if (data !== null) {
    await cacheManager.setL2(key, data, ttl); // L2 저장
    await cacheManager.setL1(key, data);       // L1 저장
  }
  return data;
}
```

**장점**:
- 캐시 미스 시 자동 로드 및 저장
- L1/L2 자동 워밍업
- 일관된 조회 인터페이스

---

## Redis 분산 락

### 락 키 명명 규칙

**파일**: `open-sam-backend/src/common/lock/distributed-lock.helper.ts`

```typescript
// 세션 상태 업데이트
`session:lock:${sessionId}`

// 전투 종료 처리
`battle:lock:${battleId}`

// 경매 정산
`auction:lock:${sessionId}:${auctionId}`

// 토너먼트 진행
`tournament:lock:${tournamentId}:round:${roundId}`

// 도시 점령
`city:lock:${sessionId}:${cityId}`

// 국가 멸망
`nation:lock:${sessionId}:${nationId}`
```

**패턴**: `{domain}:lock:{id}[:{subId}]`

### 락 획득/해제 API

#### 기본 사용법

```typescript
import { acquireDistributedLock, releaseDistributedLock } from '@/common/lock/distributed-lock.helper';

const lockKey = `session:lock:${sessionId}`;
const acquired = await acquireDistributedLock(lockKey, {
  ttl: 300,           // 5분 (초 단위)
  retry: 3,           // 재시도 3회
  retryDelayMs: 150,  // 재시도 간격 150ms
  context: 'SessionStateUpdate' // 로그용
});

if (!acquired) {
  logger.warn('락 획득 실패', { sessionId });
  return false;
}

try {
  // 임계 영역 (Critical Section)
  await updateSessionState(sessionId, updates);
} finally {
  await releaseDistributedLock(lockKey, 'SessionStateUpdate');
}
```

#### 간편 래퍼: runWithDistributedLock

```typescript
import { runWithDistributedLock } from '@/common/lock/distributed-lock.helper';

const result = await runWithDistributedLock(
  `battle:lock:${battleId}`,
  async () => {
    // 전투 종료 처리 로직
    await finalizeBattle(battleId);
    return battleResult;
  },
  {
    ttl: 180,                // 3분
    retry: 2,
    throwOnFail: true,       // 락 획득 실패 시 예외 발생
    context: 'BattleFinalize'
  }
);
```

### 락 타임아웃 및 재시도 전략

| 작업 유형 | TTL | 재시도 | 재시도 간격 | 설명 |
|----------|-----|--------|-------------|------|
| **세션 상태 업데이트** | 300초 (5분) | 3회 | 150ms | 빠른 실패, 짧은 재시도 |
| **전투 종료 처리** | 180초 (3분) | 2회 | 200ms | 중간 우선순위 |
| **경매 정산** | 120초 (2분) | 5회 | 300ms | 높은 재시도 (중요 작업) |
| **턴 처리** | 600초 (10분) | 1회 | 500ms | 긴 작업, 재시도 최소 |
| **도시 점령** | 300초 (5분) | 2회 | 200ms | 중요 작업, 중간 재시도 |

### 락 토큰 관리

**파일**: `open-sam-backend/src/common/lock/distributed-lock.helper.ts:72-74`

```typescript
const token = randomUUID(); // 각 락에 고유 UUID 할당
await redis.set(lockKey, token, 'NX', 'EX', ttl);
lockTokens.set(lockKey, token); // 로컬 저장
```

**해제 시 토큰 검증** (Lua 스크립트):
```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

**장점**:
- 다른 프로세스가 설정한 락을 실수로 해제하지 않음
- 타임아웃 후 자동 해제된 락을 다시 해제하려는 시도 안전

### 락 실패 시 대응

1. **재시도 후 실패** → 로그 남기고 작업 스킵
2. **중요 작업** (경매, 정산) → `throwOnFail: true`로 예외 발생
3. **장기 대기 금지** → 최대 재시도 시간 1-2초 이내 유지

---

## MongoDB 트랜잭션

### 트랜잭션 적용 범위

#### 트랜잭션이 **필요한** 경우

1. **도시 점령**: 도시 소유 변경 + 장수 위치 업데이트 + 국가 영토 업데이트
2. **국가 멸망**: 국가 상태 변경 + 모든 소속 장수 재배치 + 도시 중립화
3. **경매 정산**: 아이템 이전 + 금화 차감 + 낙찰 기록 생성
4. **장수 고용**: 장수 생성 + 국가 인구 차감 + 금화 차감
5. **외교 관계 변경**: 양방향 외교 상태 + 동맹국 목록 업데이트

#### 트랜잭션이 **불필요한** 경우

1. **단일 문서 업데이트**: MongoDB는 단일 문서 연산이 원자적
2. **읽기 전용 작업**: 조회만 하는 경우
3. **멱등성 보장 작업**: 재시도해도 안전한 작업
4. **성능 민감 작업**: 트랜잭션은 약 10-30% 오버헤드

### 트랜잭션 템플릿

#### 기본 패턴

```typescript
import mongoose from 'mongoose';
import { logger } from '@/common/logger';

async function complexOperation(sessionId: string, params: any) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // 트랜잭션 내부 작업
      const city = await City.findOne({ 
        session_id: sessionId, 
        city: params.cityId 
      }).session(session); // ⚠️ session() 반드시 추가
      
      city.nation = params.newNation;
      await city.save({ session });
      
      const general = await General.findOne({
        session_id: sessionId,
        no: params.generalId
      }).session(session);
      
      general.city = params.cityId;
      await general.save({ session });
      
      logger.info('트랜잭션 완료', { sessionId, params });
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 30000 // 30초 타임아웃
    });
    
    return true;
  } catch (error: any) {
    logger.error('트랜잭션 실패', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    await session.endSession();
  }
}
```

### 샘플 구현: 도시 점령

**파일**: `open-sam-backend/src/services/battle/onCityOccupied.transaction.ts`

```typescript
import mongoose from 'mongoose';
import { City } from '@/models/city.model';
import { General } from '@/models/general.model';
import { Nation } from '@/models/nation.model';
import { logger } from '@/common/logger';
import { invalidateCache } from '@/common/cache/model-cache.helper';

/**
 * 도시 점령 트랜잭션
 * 
 * 1. 도시 소유권 변경
 * 2. 점령 장수 위치 업데이트
 * 3. 구 국가 영토 감소
 * 4. 신 국가 영토 증가
 */
export async function processCityOccupation(
  sessionId: string,
  cityId: number,
  newNationId: number,
  occupyingGeneralId: number
): Promise<boolean> {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      // 1. 도시 조회 및 소유권 변경
      const city = await City.findOne({ 
        session_id: sessionId, 
        city: cityId 
      }).session(session);
      
      if (!city) {
        throw new Error(`도시를 찾을 수 없음: ${cityId}`);
      }
      
      const oldNationId = city.nation;
      city.nation = newNationId;
      city.occupied_at = new Date();
      await city.save({ session });
      
      logger.info('도시 소유권 변경', { 
        sessionId, cityId, 
        oldNation: oldNationId, 
        newNation: newNationId 
      });
      
      // 2. 점령 장수 위치 업데이트
      const general = await General.findOne({
        session_id: sessionId,
        no: occupyingGeneralId
      }).session(session);
      
      if (general) {
        general.city = cityId;
        general.last_action = 'occupy_city';
        general.last_action_at = new Date();
        await general.save({ session });
        
        logger.info('장수 위치 업데이트', { 
          sessionId, generalId: occupyingGeneralId, cityId 
        });
      }
      
      // 3. 구 국가 영토 감소
      if (oldNationId > 0) {
        const oldNation = await Nation.findOne({
          session_id: sessionId,
          nation: oldNationId
        }).session(session);
        
        if (oldNation) {
          oldNation.city_count = Math.max(0, (oldNation.city_count || 0) - 1);
          await oldNation.save({ session });
          
          logger.info('구 국가 영토 감소', { 
            sessionId, nationId: oldNationId, 
            cityCount: oldNation.city_count 
          });
        }
      }
      
      // 4. 신 국가 영토 증가
      const newNation = await Nation.findOne({
        session_id: sessionId,
        nation: newNationId
      }).session(session);
      
      if (newNation) {
        newNation.city_count = (newNation.city_count || 0) + 1;
        await newNation.save({ session });
        
        logger.info('신 국가 영토 증가', { 
          sessionId, nationId: newNationId, 
          cityCount: newNation.city_count 
        });
      }
      
      return { success: true, oldNationId, newNationId };
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 30000
    });
    
    // 트랜잭션 성공 후 캐시 무효화
    await Promise.all([
      invalidateCache('city', sessionId, cityId),
      invalidateCache('general', sessionId, occupyingGeneralId),
      invalidateCache('nation', sessionId, result.oldNationId),
      invalidateCache('nation', sessionId, result.newNationId)
    ]);
    
    return true;
  } catch (error: any) {
    logger.error('도시 점령 트랜잭션 실패', {
      sessionId, cityId, newNationId, occupyingGeneralId,
      error: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    await session.endSession();
  }
}
```

### 샘플 구현: 국가 멸망

**파일**: `open-sam-backend/src/services/nation/onNationDestroyed.transaction.ts`

```typescript
import mongoose from 'mongoose';
import { Nation } from '@/models/nation.model';
import { General } from '@/models/general.model';
import { City } from '@/models/city.model';
import { Diplomacy } from '@/models/diplomacy.model';
import { logger } from '@/common/logger';
import { invalidateCache } from '@/common/cache/model-cache.helper';

/**
 * 국가 멸망 트랜잭션
 * 
 * 1. 국가 상태 변경 (멸망)
 * 2. 모든 소속 장수 재배치 (재야/타국 투항)
 * 3. 모든 소속 도시 중립화
 * 4. 외교 관계 정리
 */
export async function processNationDestruction(
  sessionId: string,
  nationId: number
): Promise<boolean> {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      // 1. 국가 조회 및 상태 변경
      const nation = await Nation.findOne({
        session_id: sessionId,
        nation: nationId
      }).session(session);
      
      if (!nation) {
        throw new Error(`국가를 찾을 수 없음: ${nationId}`);
      }
      
      nation.status = 'destroyed';
      nation.destroyed_at = new Date();
      nation.city_count = 0;
      await nation.save({ session });
      
      logger.info('국가 멸망 처리', { sessionId, nationId });
      
      // 2. 소속 장수 재배치
      const generals = await General.find({
        session_id: sessionId,
        nation: nationId,
        'data.officer_level': { $gt: 0 } // 재야 제외
      }).session(session);
      
      for (const general of generals) {
        general.nation = 0; // 재야로 전환
        general.city = 0;
        general.officer_level = 0;
        general.last_action = 'nation_destroyed';
        general.last_action_at = new Date();
        await general.save({ session });
      }
      
      logger.info('소속 장수 재야 전환', { 
        sessionId, nationId, 
        generalCount: generals.length 
      });
      
      // 3. 소속 도시 중립화
      const cities = await City.find({
        session_id: sessionId,
        nation: nationId
      }).session(session);
      
      for (const city of cities) {
        city.nation = 0; // 중립
        city.occupied_at = new Date();
        await city.save({ session });
      }
      
      logger.info('소속 도시 중립화', { 
        sessionId, nationId, 
        cityCount: cities.length 
      });
      
      // 4. 외교 관계 정리
      await Diplomacy.deleteMany({
        session_id: sessionId,
        $or: [
          { nation_a: nationId },
          { nation_b: nationId }
        ]
      }).session(session);
      
      logger.info('외교 관계 정리 완료', { sessionId, nationId });
      
      return { 
        success: true, 
        generalCount: generals.length, 
        cityCount: cities.length 
      };
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 60000 // 1분 (많은 문서 업데이트)
    });
    
    // 트랜잭션 성공 후 캐시 대량 무효화
    await Promise.all([
      invalidateCache('nation', sessionId, nationId, { targets: ['entity', 'lists'] }),
      invalidateCache('general', sessionId, undefined, { targets: ['lists'] }),
      invalidateCache('city', sessionId, undefined, { targets: ['lists'] })
    ]);
    
    logger.info('국가 멸망 트랜잭션 완료', { 
      sessionId, nationId, 
      result 
    });
    
    return true;
  } catch (error: any) {
    logger.error('국가 멸망 트랜잭션 실패', {
      sessionId, nationId,
      error: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    await session.endSession();
  }
}
```

### 트랜잭션 옵션 설명

```typescript
{
  readPreference: 'primary',      // 프라이머리에서만 읽기 (최신 데이터)
  readConcern: { level: 'local' }, // 로컬 읽기 (빠름, 일관성 약함)
  writeConcern: { w: 'majority' }, // 과반수 노드에 쓰기 (안전함)
  maxCommitTimeMS: 30000           // 커밋 타임아웃 30초
}
```

- **readConcern: 'local'**: 성능 우선 (게임 데이터는 약간의 지연 허용)
- **writeConcern: 'majority'**: 안전성 우선 (데이터 손실 방지)
- **maxCommitTimeMS**: 작업 복잡도에 따라 조정 (30초~60초)

---

## 데몬별 적용 전략

### TurnScheduler (턴 처리)

**파일**: `open-sam-backend/src/daemon/turn-processor.ts`

#### 캐시 전략
- 턴 처리 전 세션 상태 L2 캐시에서 조회
- 처리 중 조회되는 장수/도시/국가는 getOrLoad 패턴 사용
- 처리 후 변경된 엔티티는 saveGeneral/saveCity로 Redis 저장

#### 락 전략
```typescript
const lockKey = `session:lock:${sessionId}:turn`;
const acquired = await acquireDistributedLock(lockKey, {
  ttl: 600,  // 10분 (턴 처리는 오래 걸릴 수 있음)
  retry: 1,  // 재시도 최소 (다른 프로세스가 처리 중이면 스킵)
  context: 'TurnProcessor'
});

if (!acquired) {
  logger.info('턴 처리 스킵 (다른 프로세스 처리 중)', { sessionId });
  return;
}
```

#### 트랜잭션 미사용
- 턴 처리는 수백~수천 건의 업데이트 → 트랜잭션 오버헤드 큼
- 대신 멱등성 보장: 같은 턴 번호 재처리 시 스킵 로직 추가

### BattleProcessor (전투 처리)

**파일**: `open-sam-backend/src/daemon/battle-processor.ts`

#### 캐시 전략
- 전투 중 유닛 상태는 Battle 문서 내부 필드로 관리 (캐시 미사용)
- 전투 종료 후 결과 반영 시 saveGeneral/saveCity 사용

#### 락 전략
```typescript
// 전투 종료 처리 시 (finishBattle)
const lockKey = `battle:lock:${battleId}`;
await runWithDistributedLock(
  lockKey,
  async () => {
    await handleBattleEnded(battle, winner);
    await applyCityOccupation(sessionId, cityId, newNationId);
  },
  {
    ttl: 180,  // 3분
    retry: 2,
    throwOnFail: true, // 전투 종료는 반드시 처리
    context: 'BattleFinalize'
  }
);
```

#### 트랜잭션 사용
- **도시 점령 시**: `processCityOccupation` 트랜잭션 호출
- **국가 멸망 시**: `processNationDestruction` 트랜잭션 호출

### AuctionProcessor (경매 처리)

**파일**: `open-sam-backend/src/daemon/auction-processor.ts`

#### 캐시 전략
- 경매 정산 시 낙찰자 장수 정보 getGeneral로 조회
- 정산 후 saveGeneral로 금화/아이템 업데이트

#### 락 전략
```typescript
const lockKey = `auction:lock:${sessionId}:${auctionId}`;
await runWithDistributedLock(
  lockKey,
  async () => {
    await finalizeAuction(auction);
  },
  {
    ttl: 120,  // 2분
    retry: 5,  // 높은 재시도 (중요 작업)
    retryDelayMs: 300,
    throwOnFail: true,
    context: 'AuctionFinalize'
  }
);
```

#### 트랜잭션 사용
```typescript
async function finalizeAuction(auction: IAuction) {
  const session = await mongoose.startSession();
  
  await session.withTransaction(async () => {
    // 1. 아이템 이전
    const item = await Item.findOne({ _id: auction.itemId }).session(session);
    item.owner_id = auction.winnerId;
    await item.save({ session });
    
    // 2. 금화 차감
    const winner = await General.findOne({ no: auction.winnerId }).session(session);
    winner.gold -= auction.finalPrice;
    await winner.save({ session });
    
    // 3. 경매 기록 업데이트
    auction.status = 'completed';
    auction.completed_at = new Date();
    await auction.save({ session });
  });
  
  await session.endSession();
}
```

### TournamentProcessor (토너먼트 처리)

#### 캐시 전략
- 참가자 정보는 Tournament 문서에 캐시하여 조회 최소화
- 토너먼트 종료 후 보상 지급 시 saveGeneral 사용

#### 락 전략
```typescript
// 라운드별 락 (다중 라운드 동시 진행 가능)
const lockKey = `tournament:lock:${tournamentId}:round:${roundId}`;
await runWithDistributedLock(
  lockKey,
  async () => {
    await processRound(tournament, roundId);
  },
  {
    ttl: 300,  // 5분
    retry: 2,
    context: 'TournamentRound'
  }
);
```

#### 트랜잭션 미사용
- 토너먼트는 실시간성이 중요 → 트랜잭션 오버헤드 회피
- 대신 보상 지급 실패 시 재시도 로직 구현

---

## 장애 대응

### 캐시 장애 (Redis 다운)

#### 증상
- `ECONNREFUSED` 또는 `ETIMEDOUT` 오류
- 캐시 조회/저장 시 예외 발생

#### 자동 대응 (코드 내장)
**파일**: `open-sam-backend/src/common/cache/cache.service.ts:67-82`

```typescript
} catch (error) {
  logger.error('캐시 getOrLoad 실패', { key, error });
  // 캐시 실패 시에도 DB 조회는 시도
  try {
    return await loader();
  } catch (dbError) {
    logger.error('DB 조회 실패', { key, error: dbError });
    return null;
  }
}
```

**동작**:
1. 캐시 조회 실패 → DB에서 직접 조회
2. API 응답은 정상 동작 (성능만 저하)

#### 수동 조치

**1. Redis 상태 확인**
```bash
redis-cli ping
# 응답: PONG (정상) / Error (장애)
```

**2. Redis 재시작**
```bash
sudo systemctl restart redis
# 또는
docker restart redis-container
```

**3. Redis 로그 확인**
```bash
tail -f /var/log/redis/redis-server.log
```

**4. 애플리케이션 재시작** (Redis 재연결)
```bash
pm2 restart open-sam-backend
```

**5. 캐시 워밍업** (선택)
```bash
curl -X POST http://localhost:8080/api/admin/cache/preload
```

### 락 타임아웃 (데드락)

#### 증상
- 락 획득 실패 로그 반복
- 특정 세션/전투/경매가 멈춤
- `[Lock] failed to acquire distributed lock` 로그

#### 자동 대응
- 락 TTL 도달 시 자동 해제 (5분~10분)
- 재시도 메커니즘으로 일시적 경합 해결

#### 수동 조치

**1. 락 상태 확인**
```bash
redis-cli
> KEYS *:lock:*
# 출력: 활성 락 목록

> TTL session:lock:abc123
# 출력: 남은 TTL (초) 또는 -2 (없음)
```

**2. 강제 락 해제** (주의: 작업 중복 위험)
```bash
redis-cli DEL session:lock:abc123
```

**3. 프로세스 확인**
```bash
pm2 list
pm2 logs open-sam-backend --lines 100 | grep "Lock"
```

**4. 장기 락 모니터링**
```bash
# 5분 이상 유지된 락 찾기 (Redis 6.2+)
redis-cli --scan --pattern "*:lock:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" -gt 295 ]; then
    echo "장기 락: $key (TTL: $ttl)"
  fi
done
```

### 데몬 다운 (프로세스 종료)

#### 증상
- `pm2 status` 에서 `stopped` 또는 `errored`
- 턴이 진행되지 않거나 전투/경매가 멈춤

#### 자동 재시작 (PM2 설정)

**파일**: `open-sam-backend/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'turn-processor',
      script: 'dist/daemon/turn-processor.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'battle-processor',
      script: 'dist/daemon/battle-processor.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M'
    }
  ]
};
```

#### 수동 조치

**1. 프로세스 상태 확인**
```bash
pm2 status
pm2 logs turn-processor --lines 50
```

**2. 수동 재시작**
```bash
pm2 restart turn-processor
pm2 restart battle-processor
pm2 restart auction-processor
```

**3. 전체 재시작**
```bash
pm2 restart all
```

**4. 로그 모니터링**
```bash
pm2 logs --raw | grep -E "ERROR|WARN"
```

### 헬스체크 스크립트

**파일**: `open-sam-backend/scripts/health-check.sh`

```bash
#!/bin/bash

# ===== 헬스체크 스크립트 =====
# 사용법: ./scripts/health-check.sh
# 크론탭: */5 * * * * /path/to/health-check.sh

set -e

LOG_FILE="/var/log/open-sam/health-check.log"
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
  log "🚨 ALERT: $1"
  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -X POST "$ALERT_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"🚨 오픈삼국 헬스체크 실패: $1\"}"
  fi
}

# 1. Redis 체크
log "Redis 체크 중..."
if ! redis-cli ping > /dev/null 2>&1; then
  alert "Redis 응답 없음"
  log "Redis 재시작 시도..."
  sudo systemctl restart redis || docker restart redis-container
  sleep 5
  if ! redis-cli ping > /dev/null 2>&1; then
    alert "Redis 재시작 실패"
    exit 1
  fi
  log "✅ Redis 재시작 완료"
fi

# 2. MongoDB 체크
log "MongoDB 체크 중..."
MONGO_URI="${MONGODB_URI:-mongodb://localhost:27017/openSam}"
if ! mongosh "$MONGO_URI" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
  alert "MongoDB 응답 없음"
  exit 1
fi
log "✅ MongoDB 정상"

# 3. PM2 프로세스 체크
log "PM2 프로세스 체크 중..."
DAEMONS=("turn-processor" "battle-processor" "auction-processor")

for daemon in "${DAEMONS[@]}"; do
  status=$(pm2 jlist | jq -r ".[] | select(.name==\"$daemon\") | .pm2_env.status")
  
  if [ "$status" != "online" ]; then
    alert "데몬 다운: $daemon (status: $status)"
    log "$daemon 재시작 시도..."
    pm2 restart "$daemon"
    sleep 3
    
    new_status=$(pm2 jlist | jq -r ".[] | select(.name==\"$daemon\") | .pm2_env.status")
    if [ "$new_status" != "online" ]; then
      alert "$daemon 재시작 실패"
    else
      log "✅ $daemon 재시작 완료"
    fi
  fi
done

# 4. API 엔드포인트 체크
log "API 엔드포인트 체크 중..."
API_URL="${API_URL:-http://localhost:8080}"
HEALTH_ENDPOINT="$API_URL/api/health"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" || echo "000")

if [ "$response" != "200" ]; then
  alert "API 엔드포인트 응답 없음 (HTTP $response)"
  log "API 서버 재시작 시도..."
  pm2 restart open-sam-backend
  sleep 5
  
  new_response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" || echo "000")
  if [ "$new_response" != "200" ]; then
    alert "API 서버 재시작 실패"
  else
    log "✅ API 서버 재시작 완료"
  fi
fi

# 5. 장기 락 체크
log "장기 락 체크 중..."
LONG_LOCKS=$(redis-cli --scan --pattern "*:lock:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" -gt 540 ]; then  # 9분 이상 (TTL 10분 기준)
    echo "$key"
  fi
done)

if [ -n "$LONG_LOCKS" ]; then
  alert "장기 락 감지: $LONG_LOCKS"
  # 자동 해제는 위험하므로 알림만
fi

log "✅ 헬스체크 완료"
```

**설치 및 설정**:
```bash
# 실행 권한 부여
chmod +x scripts/health-check.sh

# 크론탭 등록 (5분마다 실행)
crontab -e
*/5 * * * * /path/to/open-sam-backend/scripts/health-check.sh
```

### 자동 재시작 스크립트

**파일**: `open-sam-backend/scripts/auto-restart.sh`

```bash
#!/bin/bash

# ===== 자동 재시작 스크립트 =====
# PM2 이벤트 기반 재시작 + 로그 분석

set -e

LOG_FILE="/var/log/open-sam/auto-restart.log"
ERROR_THRESHOLD=10  # 1분 내 오류 10건 이상 시 재시작

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# PM2 로그에서 최근 1분 오류 카운트
count_recent_errors() {
  local app_name=$1
  local log_path="$HOME/.pm2/logs/${app_name}-error.log"
  
  if [ ! -f "$log_path" ]; then
    echo 0
    return
  fi
  
  # 최근 1분 내 오류 카운트
  local one_min_ago=$(date -d '1 minute ago' '+%Y-%m-%d %H:%M')
  grep -c "$one_min_ago" "$log_path" 2>/dev/null || echo 0
}

# 메모리 사용량 체크 (MB 단위)
get_memory_usage() {
  local app_name=$1
  pm2 jlist | jq -r ".[] | select(.name==\"$app_name\") | .monit.memory" | awk '{print int($1/1024/1024)}'
}

# 메인 루프
while true; do
  DAEMONS=("turn-processor" "battle-processor" "auction-processor" "open-sam-backend")
  
  for daemon in "${DAEMONS[@]}"; do
    # 오류 카운트 체크
    error_count=$(count_recent_errors "$daemon")
    if [ "$error_count" -ge "$ERROR_THRESHOLD" ]; then
      log "🔄 $daemon 재시작 (오류 ${error_count}건 감지)"
      pm2 restart "$daemon"
      sleep 5
      continue
    fi
    
    # 메모리 사용량 체크 (1.5GB 이상 시 재시작)
    mem_usage=$(get_memory_usage "$daemon")
    if [ "$mem_usage" -ge 1536 ]; then
      log "🔄 $daemon 재시작 (메모리 ${mem_usage}MB 초과)"
      pm2 restart "$daemon"
      sleep 5
    fi
  done
  
  sleep 60  # 1분마다 체크
done
```

**백그라운드 실행**:
```bash
nohup ./scripts/auto-restart.sh > /var/log/open-sam/auto-restart-daemon.log 2>&1 &
```

---

## 요약

### 캐시 전략
- **L1 (3초)**: 동일 요청 반복 조회 최적화
- **L2 (360초)**: 프로세스 간 공유, DB 부하 감소
- **무효화**: 업데이트 시 즉시, 패턴 매칭 지원

### 락 전략
- **획득**: `acquireDistributedLock(key, { ttl, retry, retryDelayMs, context })`
- **해제**: `releaseDistributedLock(key, context)`
- **래퍼**: `runWithDistributedLock(key, task, options)`
- **타임아웃**: 5분~10분, 작업 유형별 차등

### 트랜잭션 전략
- **적용**: 도시 점령, 국가 멸망, 경매 정산, 장수 고용, 외교 관계
- **미적용**: 단일 문서 업데이트, 읽기 전용, 멱등성 보장 작업
- **옵션**: `readConcern: local`, `writeConcern: majority`, `maxCommitTimeMS: 30000`

### 장애 대응
- **캐시 장애**: 자동 DB 폴백 → 수동 Redis 재시작
- **락 타임아웃**: 자동 TTL 해제 → 수동 강제 해제
- **데몬 다운**: PM2 자동 재시작 → 헬스체크 스크립트 모니터링

---

**작성일**: 2025-11-23  
**버전**: 1.0.0  
**문서 관리**: `open-sam-backend/docs/PERSISTENCE_AND_CACHE_ARCHITECTURE.md`
