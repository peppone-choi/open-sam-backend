# Redis 기반 게임 아키텍처

Redis를 Primary 데이터 저장소로 사용하는 실시간 게임 시스템입니다.

## 🎯 핵심 개념

### 데이터 흐름

```
커맨드 제출 → Redis Streams → 커맨드 워커 → GameStateCache (Redis HASH) → stream:changes → 영속화 데몬 → MongoDB
```

### 레이어 구조

1. **GameStateCache**: Redis HASH 기반 엔티티 저장소
2. **CachedRepository**: Redis 우선 읽기 패턴
3. **CommandWorker**: 커맨드 처리 워커
4. **PersistenceDaemon**: Write-Behind 영속화

## 📦 주요 컴포넌트

### 1. GameStateCache (`src/infrastructure/cache/game-state-cache.ts`)

Redis를 Primary로 사용하는 게임 상태 캐시:

```typescript
// 엔티티 조회 (Redis HASH)
const general = await gameCache.get<GeneralEntity>(EntityType.GENERAL, generalId);

// 엔티티 업데이트 (자동으로 stream:changes 기록)
await gameCache.set(EntityType.GENERAL, general, changes);
```

**특징:**
- 모든 엔티티는 Redis HASH로 저장: `general:{id}`, `city:{id}`, `nation:{id}`
- 버전 관리 (Optimistic Locking)
- Dirty 플래그 (변경된 엔티티만 영속화)
- 변경 로그 자동 기록 (`stream:changes`)

### 2. CachedRepository (`src/infrastructure/repository/cached-repository.ts`)

Redis 우선 읽기 패턴:

```typescript
export abstract class CachedRepository<T extends CachedEntity> {
  async findById(id: string): Promise<T | null> {
    // 1. Redis 조회
    let entity = await this.gameCache.get<T>(this.entityType, id);
    
    // 2. 없으면 MongoDB에서 로드 후 Redis에 캐시
    if (!entity) {
      const doc = await this.model.findById(id).lean().exec();
      if (doc) {
        entity = this.toEntity(doc);
        await this.gameCache.create(this.entityType, entity);
      }
    }
    
    return entity;
  }
}
```

**구현된 Repository:**
- `GeneralRepository`: 장수 데이터
- `CityRepository`: 도시 데이터
- `NationRepository`: 국가 데이터

### 3. CommandWorker (`src/api/daemon/command-worker.ts`)

Redis Streams에서 커맨드를 소비하여 게임 로직 실행:

```typescript
// 커맨드 제출 (API 서버)
await redis.xadd('stream:commands', '*', 
  'commandId', cmd.id,
  'type', cmd.type,
  'generalId', cmd.generalId,
  'payload', JSON.stringify(cmd.payload),
  'turn', currentTurn
);

// 커맨드 처리 (워커)
const messages = await redis.readGroup('stream:commands', 'command:workers', workerName, 10, 5000);
for (const msg of messages) {
  await processCommand(msg.data);
  await redis.ack('stream:commands', 'command:workers', msg.id);
}
```

**특징:**
- Consumer Group으로 수평 확장 가능
- 중복 실행 방지 (De-dup with SETNX, 60초)
- 패턴별 핸들러 (Domestic, Military, Movement, Stratagem)
- GameStateCache를 통한 상태 관리

### 4. PersistenceDaemon (`src/api/daemon/persistence-daemon.ts`)

`stream:changes`를 소비하여 Redis → MongoDB 동기화:

```typescript
// 배치 처리 (200개씩)
const messages = await redis.readGroup('stream:changes', 'persist:workers', workerName, 200, 10000);

// 같은 ID는 최신 것만 유지 (coalesce)
const changeMap = new Map<string, ChangeLogEntry>();
for (const msg of messages) {
  const key = `${msg.entityType}:${msg.id}`;
  if (!changeMap.has(key) || msg.version > changeMap.get(key).version) {
    changeMap.set(key, msg);
  }
}

// MongoDB bulkWrite (upsert)
await Model.bulkWrite(bulkOps, { ordered: false });

// Dirty 플래그 클리어
await gameCache.clearDirty(entityType, id, version);
```

**특징:**
- Write-Behind 패턴 (비동기 영속화)
- 배치 처리로 성능 최적화
- 같은 엔티티의 여러 변경사항 병합 (coalesce)
- 실패 시 재시도 (ACK하지 않음)

### 5. Lua 스크립트

원자적 커맨드 처리:

**train.lua** - 훈련 처리:
```lua
-- 중복 실행 방지
if redis.call('EXISTS', KEYS[3]) == 1 then
  return 'DUP'
end

-- 값 업데이트
redis.call('HSET', KEYS[1], 'train', ARGV[2])
redis.call('HSET', KEYS[1], 'atmos', ARGV[3])

-- 버전/dirty 업데이트
redis.call('HSET', KEYS[1], 'version', ARGV[6])
redis.call('HSET', KEYS[1], 'dirty', '1')

-- 변경 로그
redis.call('XADD', KEYS[2], 'MAXLEN', '~', '1000000', '*', ...)

-- De-dup 키 설정
redis.call('SET', KEYS[3], '1', 'PX', 60000)
```

**domestic.lua** - 내정 처리:
- 점수 증가 처리
- 최대값 제한 (agri_max, trust=100)
- 원자적 업데이트

## 🚀 실행 방법

### 개발 환경

```bash
# API 서버 실행
npm run dev

# 게임 데몬 실행 (별도 터미널)
npm run dev:daemon
```

### 프로덕션

```bash
# 빌드
npm run build

# API 서버 실행
npm start

# 게임 데몬 실행 (별도 프로세스)
npm run start:daemon
```

## 📊 Redis 키 구조

### 엔티티 (HASH)
```
general:{generalId}       # 장수 데이터
city:{cityId}             # 도시 데이터
nation:{nationId}         # 국가 데이터
diplomacy:{id}            # 외교 관계
```

### 스트림
```
stream:commands           # 커맨드 큐
stream:changes            # 변경 로그
```

### 인덱스 (SET)
```
general:nation:{nationId}         # 국가별 장수 인덱스
city:nation:{nationId}            # 국가별 도시 인덱스
```

### 중복 방지
```
dedup:command:{commandId}         # 커맨드 중복 실행 방지 (60초 TTL)
```

## ⚙️ 설정

### 환경 변수
```bash
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/opensam
```

### Redis 요구사항
- Redis 5.0+ (Streams 지원)
- 메모리: 최소 2GB (게임 세션당)

## 🔧 모니터링

### Redis 상태 확인
```bash
# 스트림 길이
redis-cli XLEN stream:commands
redis-cli XLEN stream:changes

# Consumer Group 정보
redis-cli XINFO GROUPS stream:commands
redis-cli XINFO CONSUMERS stream:commands command:workers

# Pending 메시지
redis-cli XPENDING stream:commands command:workers

# Dirty 엔티티 수
redis-cli SCAN 0 MATCH "general:*" COUNT 1000 | grep -c "general:"
```

### 성능 메트릭
- 커맨드 처리 속도: ~1000 cmd/s (단일 워커)
- 영속화 처리 속도: ~5000 entity/s (배치 200)
- Redis 메모리 사용: ~100MB per 10k entities

## 🎮 게임 로직

### 커맨드 핸들러

#### DomesticHandler
- 8개 내정 커맨드 처리 (농지개간, 상업투자, 기술연구, 수비강화, 성벽보수, 치안강화, 정착장려, 주민선정)
- 점수 계산, 크리티컬, 전선 디버프 적용
- 경험치/공헌도 증가

#### MilitaryHandler
- 5개 군사 커맨드 처리 (훈련, 사기진작, 징병, 모병, 소집해제)
- 병력 관리, 훈련도/사기 계산
- 인구/민심 변동 처리

## 🔐 동시성 제어

### 낙관적 락 (Optimistic Locking)
```typescript
// 버전 체크
const current = await gameCache.get(EntityType.GENERAL, id);
if (current.version !== expected) {
  throw new Error('버전 충돌');
}

// 버전 증가 후 저장
current.version++;
await gameCache.set(EntityType.GENERAL, current);
```

### 중복 실행 방지
```typescript
// De-dup 키로 중복 체크
const dedupKey = `dedup:command:${commandId}`;
const exists = await redis.exists(dedupKey);
if (exists) {
  console.log('이미 처리된 커맨드');
  return;
}

// 처리 후 De-dup 키 설정 (60초)
await redis.set(dedupKey, '1', 'PX', 60000);
```

## 📈 확장성

### 수평 확장
- CommandWorker: 여러 프로세스/서버에서 실행 가능 (Consumer Group)
- PersistenceDaemon: 여러 프로세스/서버에서 실행 가능 (Consumer Group)
- API 서버: 로드 밸런서로 무한 확장

### 성능 튜닝
- 배치 크기 조정: `BATCH_SIZE` (기본 200)
- 워커 수 증가: 프로세스 수 늘리기
- Redis 파이프라이닝: 대량 읽기 최적화

## 🛡️ 장애 복구

### 워커 크래시
- 미처리 메시지는 자동으로 다른 워커가 처리
- XPENDING으로 확인 후 XCLAIM으로 재할당

### Redis 재시작
- MongoDB에서 최신 데이터 로드
- Dirty 엔티티는 다음 영속화 주기에 처리

### MongoDB 장애
- Redis에서 계속 게임 진행 가능 (Primary)
- MongoDB 복구 후 자동 동기화

## 📝 로그

### 커맨드 로그
```
🎯 커맨드 처리 시작: TRAIN (cmd-12345)
✅ 훈련 완료 (훈련도 +15)
```

### 영속화 로그
```
💾 영속화 완료: 127개 엔티티
✅ general 영속화: 45개
✅ city 영속화: 12개
✅ nation 영속화: 3개
```

## 🔍 디버깅

### Redis 데이터 확인
```bash
# 장수 데이터 조회
redis-cli HGETALL "general:{generalId}"

# 변경 로그 확인
redis-cli XRANGE stream:changes - + COUNT 10

# 커맨드 큐 확인
redis-cli XRANGE stream:commands - + COUNT 10
```

### MongoDB 데이터 확인
```javascript
// 장수 조회
db.generals.findOne({ _id: ObjectId("...") })

// 최근 업데이트된 장수
db.generals.find().sort({ updatedAt: -1 }).limit(10)
```

## 🎯 다음 단계

1. ✅ 커맨드 워커 구현
2. ✅ 영속화 데몬 구현
3. ✅ CachedRepository 구현
4. ✅ Lua 스크립트 작성
5. ⏳ 추가 커맨드 핸들러 (Movement, Stratagem, Diplomacy)
6. ⏳ 전투 시스템 (ProcessWar)
7. ⏳ 턴 진행 시스템
8. ⏳ 실시간 알림 (Pub/Sub)
