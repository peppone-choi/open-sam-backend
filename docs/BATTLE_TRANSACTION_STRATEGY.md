# 전투 처리 MongoDB 트랜잭션 및 락 전략

## 개요

전투 종료 후 월드 상태 반영 시 데이터 일관성을 보장하기 위한 트랜잭션 및 락 전략 문서입니다.

## 핵심 원칙

1. **원자성 보장**: 도시 점령, 자원 이전, 장수 이동은 하나의 트랜잭션으로 처리
2. **격리 수준**: MongoDB의 기본 격리 수준(Snapshot Isolation) 사용
3. **낙관적 락**: 빈번하지 않은 도시 점령 작업에는 낙관적 락 사용
4. **재시도 전략**: 트랜잭션 충돌 시 최대 3회 재시도

## 트랜잭션 범위

### 1. 도시 점령 트랜잭션 (onCityOccupied)

#### 포함 작업
- 도시 소유권 변경
- 도시 자원의 50% 이전
- 도시 내 장수 이동
- 공격자 국가 자원 증가
- conflict 초기화

#### 구현 방식
```typescript
async function onCityOccupied(
  sessionId: string,
  cityId: number,
  attackerNationId: number,
  attackerGeneralId: number
): Promise<void> {
  const session = await DB.db().startSession();
  
  try {
    await session.withTransaction(async () => {
      // 1. 도시 조회 및 락
      const city = await cityRepository.findOneAndLock(
        { session_id: sessionId, 'data.city': cityId },
        { session }
      );
      
      // 2. 자원 계산
      const absorbedGold = Math.floor((city.data?.gold || 0) * 0.5);
      const absorbedRice = Math.floor((city.data?.rice || 0) * 0.5);
      
      // 3. 장수 이동 (배치 처리)
      await moveGeneralsOnOccupation(sessionId, cityId, session);
      
      // 4. 국가 자원 업데이트
      await nationRepository.updateByNationNum(
        sessionId,
        attackerNationId,
        { $inc: { 'data.gold': absorbedGold, 'data.rice': absorbedRice } },
        { session }
      );
      
      // 5. 도시 소유권 변경 및 자원 차감
      await cityRepository.updateByCityNum(
        sessionId,
        cityId,
        {
          nation: attackerNationId,
          gold: city.data.gold - absorbedGold,
          rice: city.data.rice - absorbedRice,
          conflict: '{}'
        },
        { session }
      );
    });
    
    // 트랜잭션 외부 작업: 이벤트 트리거, 로그 생성
    await ExecuteEngineService.runEventHandler(sessionId, 'OCCUPY_CITY', { ... });
    await createDiplomaticLog(sessionId, ...);
    
  } catch (error) {
    logger.error('[Transaction] City occupation failed', { error });
    throw error;
  } finally {
    await session.endSession();
  }
}
```

### 2. 국가 멸망 트랜잭션 (onNationDestroyed)

#### 포함 작업
- 국가 내 모든 장수 재야 전환
- 관직자 강등
- 국가 자원의 50% 이전 (기본량 제외)

#### 구현 방식
```typescript
async function onNationDestroyed(
  sessionId: string,
  destroyedNationId: number,
  attackerNationId: number
): Promise<void> {
  const session = await DB.db().startSession();
  
  try {
    await session.withTransaction(async () => {
      // 1. 멸망 국가 조회 및 락
      const nation = await nationRepository.findOneAndLock(
        { session_id: sessionId, 'data.nation': destroyedNationId },
        { session }
      );
      
      // 2. 자원 계산
      const loseGold = Math.max((nation.data?.gold || 0) - baseGold, 0);
      const loseRice = Math.max((nation.data?.rice || 0) - baseRice, 0);
      const absorbedGold = Math.floor(loseGold / 2);
      const absorbedRice = Math.floor(loseRice / 2);
      
      // 3. 장수 일괄 업데이트
      await generalRepository.updateManyByFilter(
        { session_id: sessionId, 'data.nation': destroyedNationId },
        {
          $set: {
            'data.nation': 0,
            'data.officer_level': 1,
            'data.officer_city': 0
          }
        },
        { session }
      );
      
      // 4. 공격자 국가 자원 증가
      await nationRepository.updateByNationNum(
        sessionId,
        attackerNationId,
        { $inc: { 'data.gold': absorbedGold, 'data.rice': absorbedRice } },
        { session }
      );
    });
    
    // 트랜잭션 외부: 이벤트 트리거
    await ExecuteEngineService.runEventHandler(sessionId, 'DESTROY_NATION', { ... });
    
  } catch (error) {
    logger.error('[Transaction] Nation destruction failed', { error });
    throw error;
  } finally {
    await session.endSession();
  }
}
```

## 락 전략

### 1. 낙관적 락 (Optimistic Locking)

도시 점령은 빈번하지 않으므로 낙관적 락 사용:

```typescript
// 도시 문서에 version 필드 추가
interface CityDocument {
  _id: ObjectId;
  session_id: string;
  data: {
    city: number;
    nation: number;
    version: number; // 낙관적 락용 버전
    // ...
  };
}

// 업데이트 시 버전 체크
await cityRepository.updateOne(
  {
    session_id: sessionId,
    'data.city': cityId,
    'data.version': currentVersion
  },
  {
    $set: { 'data.nation': newNationId },
    $inc: { 'data.version': 1 }
  }
);
```

### 2. 비관적 락 (Pessimistic Locking)

필요 시 MongoDB의 findAndModify를 사용한 비관적 락:

```typescript
const city = await cityCollection.findOneAndUpdate(
  { session_id: sessionId, 'data.city': cityId },
  { $set: { 'data.locked': true } },
  { returnDocument: 'after', session }
);

// 작업 수행...

// 락 해제
await cityCollection.updateOne(
  { _id: city._id },
  { $unset: { 'data.locked': 1 } },
  { session }
);
```

## 재시도 전략

트랜잭션 충돌 시 재시도:

```typescript
async function retryTransaction<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // TransientTransactionError인 경우에만 재시도
      if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
        logger.warn(`[Transaction] Retry attempt ${attempt}/${maxRetries}`, { error });
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // 백오프
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// 사용 예
await retryTransaction(async () => {
  await onCityOccupied(sessionId, cityId, attackerNationId, attackerGeneralId);
});
```

## 동시성 제어

### 1. 도시별 락

도시 단위로 락을 걸어 동시 점령 방지:

```typescript
// Redis를 사용한 분산 락
import { Redis } from 'ioredis';

async function acquireCityLock(sessionId: string, cityId: number): Promise<boolean> {
  const redis = new Redis();
  const lockKey = `battle:lock:${sessionId}:city:${cityId}`;
  const lockValue = `${Date.now()}`;
  
  // NX: 키가 없을 때만 설정, EX: 10초 후 자동 만료
  const result = await redis.set(lockKey, lockValue, 'NX', 'EX', 10);
  
  return result === 'OK';
}

async function releaseCityLock(sessionId: string, cityId: number): Promise<void> {
  const redis = new Redis();
  const lockKey = `battle:lock:${sessionId}:city:${cityId}`;
  await redis.del(lockKey);
}

// 사용 예
const locked = await acquireCityLock(sessionId, cityId);
if (!locked) {
  throw new Error('City is already being processed');
}

try {
  await onCityOccupied(sessionId, cityId, attackerNationId, attackerGeneralId);
} finally {
  await releaseCityLock(sessionId, cityId);
}
```

### 2. 전역 전투 큐

전투 결과를 큐에 넣어 순차 처리:

```typescript
import Bull from 'bull';

const battleResultQueue = new Bull('battle-results', {
  redis: { host: 'localhost', port: 6379 }
});

// 전투 종료 시 큐에 추가
battleResultQueue.add('process-battle-result', {
  sessionId,
  battleId,
  winner,
  targetCityId,
  attackerNationId,
  attackerGeneralId
});

// 워커에서 순차 처리
battleResultQueue.process('process-battle-result', async (job) => {
  const { sessionId, targetCityId, attackerNationId, attackerGeneralId } = job.data;
  
  await retryTransaction(async () => {
    await onCityOccupied(sessionId, targetCityId, attackerNationId, attackerGeneralId);
  });
});
```

## 성능 최적화

### 1. 배치 업데이트

장수 이동 시 개별 업데이트 대신 배치 업데이트:

```typescript
// ❌ 비효율적
for (const general of generals) {
  await generalRepository.updateOne({ no: general.no }, { $set: { nation: 0 } });
}

// ✅ 효율적
await generalRepository.updateMany(
  { nation: oldNationId, city: cityId },
  { $set: { nation: 0, city: 0 } }
);
```

### 2. 인덱스 활용

트랜잭션에서 자주 사용하는 쿼리에 인덱스 생성:

```typescript
// 도시 조회 인덱스
db.cities.createIndex({ "session_id": 1, "data.city": 1 });

// 장수 조회 인덱스
db.generals.createIndex({ "session_id": 1, "data.nation": 1, "data.city": 1 });

// 국가 조회 인덱스
db.nations.createIndex({ "session_id": 1, "data.nation": 1 });
```

## 에러 처리

### 1. 부분 실패 처리

트랜잭션 실패 시 롤백 및 에러 로깅:

```typescript
try {
  await session.withTransaction(async () => {
    // ...
  });
} catch (error: any) {
  logger.error('[Transaction] Failed', {
    sessionId,
    cityId,
    error: error.message,
    stack: error.stack
  });
  
  // 사용자에게 에러 알림
  await notifyBattleError(sessionId, cityId, error.message);
  
  throw error;
}
```

### 2. 데드락 방지

항상 같은 순서로 락 획득:

```typescript
// 도시 ID 오름차순으로 정렬하여 데드락 방지
const sortedCityIds = [cityId1, cityId2].sort((a, b) => a - b);

for (const id of sortedCityIds) {
  await acquireCityLock(sessionId, id);
}
```

## 모니터링

### 1. 트랜잭션 메트릭 수집

```typescript
import { Counter, Histogram } from 'prom-client';

const transactionCounter = new Counter({
  name: 'battle_transactions_total',
  help: 'Total number of battle transactions',
  labelNames: ['type', 'status']
});

const transactionDuration = new Histogram({
  name: 'battle_transaction_duration_seconds',
  help: 'Duration of battle transactions',
  labelNames: ['type']
});

// 사용 예
const timer = transactionDuration.startTimer({ type: 'city_occupation' });
try {
  await onCityOccupied(...);
  transactionCounter.inc({ type: 'city_occupation', status: 'success' });
} catch (error) {
  transactionCounter.inc({ type: 'city_occupation', status: 'failure' });
  throw error;
} finally {
  timer();
}
```

## 체크리스트

전투 트랜잭션 구현 시 확인 사항:

- [ ] 트랜잭션 범위가 최소화되어 있는가?
- [ ] 트랜잭션 외부에서 수행할 작업(로그, 이벤트)이 분리되어 있는가?
- [ ] 재시도 로직이 구현되어 있는가?
- [ ] 동시성 제어(락)가 필요한 부분에 적용되어 있는가?
- [ ] 배치 업데이트를 사용하고 있는가?
- [ ] 필요한 인덱스가 모두 생성되어 있는가?
- [ ] 에러 처리 및 로깅이 충분한가?
- [ ] 데드락 가능성이 없는가?
- [ ] 트랜잭션 메트릭이 수집되고 있는가?

## 참고 자료

- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [MongoDB Transaction Retry Logic](https://www.mongodb.com/docs/manual/core/transactions/#retry-transaction)
- [Redis Distributed Locks](https://redis.io/docs/manual/patterns/distributed-locks/)
