# 삼국지 게임 PHP → Node.js 마이그레이션 전략

## TL;DR
- 단일 쓰기 데몬(턴 엔진)과 읽기 전용 API로 CQRS를 구현하고, MongoDB를 이벤트 저장소 + 읽기 모델로 사용합니다.
- Strangler(병행) 전략으로 Read 모델부터 이행하고, 점진적으로 Write(명령/전투/턴 처리)로 확장합니다.
- 가장 간단한 형태: 한 개의 Node.js 데몬이 모든 쓰기를 직렬화하고 이벤트로 영속화, API는 이벤트 기반 프로젝션을 읽습니다.

---

## 1. 현재 상태 분석 (가정 포함)

### 1.1 폴더 구조 (추정)
```
core/
├── hwe/              # 게임 엔진/턴 처리/전투 시뮬레이션
├── sammo/            # 공통 유틸, 도메인 객체, DAO
├── api/ 또는 web/    # HTTP 엔드포인트, 세션/인증
├── daemon/           # 턴 배치 처리 데몬
├── conf/config/      # DB/캐시 설정, 상수
├── lib/vendor/       # 외부 라이브러리
├── scripts/          # 유지보수 스크립트
└── tests/            # 단위/통합 테스트
```

**기술 스택:**
- PHP 8.0
- MariaDB (8개 DB 사용)
- 일부 TypeScript/JavaScript (웹 클라이언트)

### 1.2 핵심 기능 (도메인)

#### 턴제 게임 루프
- N분마다 데몬이 턴 시작 → 명령 수집 → 실행 → 상태 갱신 → 로그 생성

#### 전투 시스템
- 병종/지형/사기/지휘/스킬/랜덤 시드 기반 결과 산출
- 도시 점령/수성, 부대 이동, 피해/사상자/포획/전리품

#### 외교 시스템
- 동맹/불가침/휴전/파기 제안·수락·만료

#### 명령 처리
- 플레이어가 큐에 명령 등록 (훈련, 이동, 징병, 개발, 외교, 기술, 건설)
- 턴 시 데몬이 검증 → 실행 → 결과 기록

#### 기타
- 랭킹/통계/알림/우편/로그

### 1.3 데이터베이스 구조 (추정)

**8개 DB 샤딩/도메인별 분리:**
1. user (계정/세션)
2. world (지도/도시/자원)
3. nation (국가/외교/정책)
4. army/units (부대/장수/장비)
5. orders/turns (명령/턴)
6. logs/battles (전투/이벤트 로그)
7. mail/notifications
8. audit/admin

**특성:**
- 조인 중심 정규화
- 배치 처리에서 트랜잭션/락 사용
- 다량의 append-only 로그 테이블

### 1.4 핵심 비즈니스 규칙
- 결정적/반결정적 전투 계산식 (랜덤 시드 필요)
- 명령 유효성 검증 (자원, 상태, 쿨다운, 위치)
- 동시성 제어 (한 턴 내 중복 명령, 레이스 방지)
- 계정 보안/부정행위 방지
- 시간 규칙 (서버 타임존, 턴 롤오버 일관성)

---

## 2. 목표 아키텍처 (Node.js + TypeScript + MongoDB + CQRS)

### 2.1 아키텍처 개요

#### Read (쿼리) - API 서버
- Express + MongoDB Read 모델
- 인증/세션/레이트 리밋
- 다중 인스턴스 가능 (수평 확장)

#### Write (명령) - 턴 데몬
- 명령 큐 수집
- 턴 경계에서 일괄 실행
- 이벤트 생성 (append-only events 컬렉션)
- 프로젝션 업데이트 (읽기 모델 denormalize)
- **단일 인스턴스** (Single Writer)

#### 스토리지 - MongoDB
- 이벤트 저장소 (events)
- 집계 상태 스냅샷 (snapshots)
- 읽기 모델 (projections/*)
- 장기 로그 (time-series)

#### 통신
- API는 기본 Read-only
- 쓰기 요청은 명령(enqueue) API 제공
- 처리/적용은 데몬에서만

### 2.2 레포 구조 (제안)

```
src/
├── server.ts           # API 서버 (Read)
├── daemon.ts           # 턴 데몬 (Write)
├── domain/             # 도메인 로직
│   ├── general/
│   ├── city/
│   ├── nation/
│   ├── battle/
│   └── command/
├── infrastructure/     # 인프라 레이어
│   ├── db/
│   │   ├── schemas/
│   │   └── repositories/
│   ├── events/
│   └── projections/
├── api/                # HTTP 레이어
│   ├── routes/
│   └── controllers/
└── shared/             # 공통 유틸
    ├── types/
    ├── validators/
    └── utils/
```

---

## 3. 도메인/데이터 모델 매핑 (MariaDB → MongoDB)

### 3.1 핵심 컬렉션

#### players (계정)
```typescript
{
  _id: ObjectId,
  name: string,
  email: string,
  passwordHash: string,
  settings: object,
  createdAt: Date
}
// index: email (unique), name (unique)
```

#### generals (장수)
```typescript
{
  _id: ObjectId,
  ownerId: ObjectId,
  nationId: ObjectId,
  cityId: ObjectId | null,
  stats: {
    level: number,
    command: number,
    strength: number,
    intelligence: number,
    leadership: number
  },
  skills: ObjectId[],
  status: string,
  equipment: ObjectId[],
  hp: number,
  maxHp: number
}
// index: ownerId, nationId, cityId
```

#### nations (국가)
```typescript
{
  _id: ObjectId,
  name: string,
  rulerId: ObjectId,
  members: ObjectId[],
  policies: object,
  diplomacy: [
    {
      targetId: ObjectId,
      type: string, // 'alliance' | 'truce' | 'war'
      expiresAt: Date
    }
  ],
  treasury: { gold: number, food: number }
}
// index: name (unique)
```

#### cities (도시)
```typescript
{
  _id: ObjectId,
  name: string,
  coord: { x: number, y: number },
  resources: {
    population: number,
    agriculture: number,
    commerce: number,
    security: number,
    defense: number
  },
  buildings: object[],
  garrison: {
    soldiers: number,
    generalIds: ObjectId[]
  },
  nationId: ObjectId
}
// index: coord (unique), nationId
```

#### orders (명령 큐)
```typescript
{
  _id: ObjectId,
  playerId: ObjectId,
  generalId: ObjectId,
  type: string, // 'move' | 'train' | 'recruit' | etc
  payload: object,
  submittedAt: Date,
  turn: number,
  status: 'pending' | 'processing' | 'completed' | 'failed'
}
// index: turn+status, playerId
```

#### events (이벤트 저장소)
```typescript
{
  _id: ObjectId,
  ts: Date,
  turn: number,
  aggregateType: string,
  aggregateId: ObjectId,
  type: string, // 'ArmyMoved' | 'BattleResolved' | etc
  version: number,
  payload: object
}
// index: turn, aggregateType+aggregateId, type
```

#### battleLogs (전투 기록)
```typescript
{
  _id: ObjectId,
  turn: number,
  cityId: ObjectId,
  attackers: object[],
  defenders: object[],
  outcome: string,
  rngSeed: number,
  casualties: object,
  loot: object
}
// index: turn, cityId
// time-series collection 권장
```

### 3.2 설계 원칙
- 집계 경계는 단일 커맨드 일관성 필요 수준으로 최소화
- 교차 집계 연산은 이벤트 기반 또는 순차 처리
- 로그/전투/이벤트는 append-only, TTL 또는 아카이브

---

## 4. CQRS 적용 방안

### 4.1 커맨드 흐름 (API → 큐 → 데몬)

```
1. 플레이어 → API POST /orders/move
2. API: 검증 (형식, 소유권) → orders 삽입 (status=pending)
3. 데몬: 턴 시작 → orders.find({turn:N, status:'pending'})
4. 데몬: 정렬 → 재검증 → 실행 → 이벤트 생성
5. 데몬: 상태 업데이트 → 프로젝션 갱신 → battleLogs 생성
```

### 4.2 이벤트 예시

```typescript
// 턴 시작/종료
TurnStarted { turn, startedAt, seed }
TurnEnded { turn, endedAt, stats }

// 명령 처리
OrderQueued { orderId, generalId, type }
OrderExecuted { orderId, result }
OrderRejected { orderId, reason }

// 전투
ArmyMoved { armyId, from, to }
BattleResolved { battleId, winner, casualties }
CityCaptured { cityId, oldOwner, newOwner }

// 자원
ResourceChanged { entityId, resource, delta }

// 외교
DiplomacyProposed { fromNation, toNation, type }
DiplomacyAccepted { fromNation, toNation, type }
```

### 4.3 프로젝션

```typescript
// 데몬이 이벤트 기록 후 동일 순서로 프로젝션 업데이트
// 단일 쓰기 프로세스이므로 레이스 없음

on CityCaptured:
  projection_city_overview.update(
    { cityId },
    { nationId, garrison, lastBattleAt }
  )

on ResourceChanged:
  projection_nation_dashboard.increment(
    { nationId },
    { [`resources.${resource}`]: delta }
  )
```

### 4.4 트랜잭션/일관성
- 단일 데몬 직렬 처리 → 동일 집계 경쟁 없음
- MongoDB 멀티 도큐먼트 트랜잭션 최소화
- 필요 시 writeConcern majority + session 트랜잭션

---

## 5. PHP → Node.js 전환 계획

### 5.1 최소주의 원칙
- 전투/명령 규칙은 일단 원형 유지 (동일 파라미터/시드로 동일 결과)
- Deterministic RNG (seedrandom 라이브러리)
- 기존 밸런스 수치/공식 그대로 이전 → 회귀 테스트

### 5.2 코드 이전 순서

#### 1단계: 분석/가시화 (Small)
- 레포 매핑 스크립트
- ERD 스냅샷 (schema export)
- 턴 루프/전투 함수 식별
- 상수/밸런스 테이블 확인

#### 2단계: Read 모델 섀도잉 (Medium)
- MariaDB → MongoDB ETL (주기적 dump)
- Read-only API (Node.js)
- 프론트엔드 일부 화면 전환

#### 3단계: 명령 Enqueue API (Medium)
- Node.js orders API
- PHP/Node 이중 기록 (또는 토글)
- 실행은 여전히 PHP 데몬

#### 4단계: 턴 데몬 치환 (Large)
- Node.js 데몬이 orders 실행
- MariaDB 동기화 ACL
- 점차 PHP 데몬 중단

#### 5단계: 전투/외교 코어 교체 (Large)
- 전투 계산식 리라이트
- 회귀 테스트: 결과 일치율 100%

#### 6단계: 완전 컷오버 (Medium)
- 쓰기 경로 완전 이전
- MariaDB 읽기 의존 해제
- 최종 데이터 마이그레이션

---

## 6. MariaDB → MongoDB 마이그레이션

### 6.1 데이터 이전
- 초기 풀 덤프 → 변환 스크립트 → collections 적재
- 외래키 → 참조 필드 매핑
- 읽기 모델에서 denormalize
- ID 전략: 기존 PK 보존 또는 ULID/UUIDv7

### 6.2 동기화 (병행 운영)
- Change capture
  - 간단: 턴 경계마다 증분 ETL
  - 고급: MariaDB binlog CDC
- 검증
  - 샘플링/해시 비교
  - 비즈니스 invariants 체크

---

## 7. 턴 데몬 설계 (간단 경로)

### 7.1 단일 프로세스 + node-cron

```typescript
import cron from 'node-cron';

// 매 5분마다 턴 실행
cron.schedule('*/5 * * * *', async () => {
  await runTurn();
});

async function runTurn() {
  const turnNumber = await getNextTurnNumber();
  const seed = deriveSeed(turnNumber, worldId);
  
  // 1. 명령 수집
  const orders = await db.orders.find({
    turn: turnNumber,
    status: 'pending'
  }).sort({ priority: -1, ts: 1 }).toArray();
  
  // 2. 실행
  const events = [];
  for (const order of orders) {
    const result = await executeOrder(order, seed);
    events.push(...result.events);
  }
  
  // 3. 이벤트 저장
  await db.events.insertMany(events);
  
  // 4. 상태 업데이트
  await applyEvents(events);
  
  // 5. 프로젝션 갱신
  await updateProjections(events);
  
  // 6. 로그 생성
  await generateBattleLogs(events);
}
```

### 7.2 동시성 제어
- 데몬만 쓰기
- API는 읽기와 enqueue만
- 락 컬렉션으로 리더 선출 (선택)

---

## 8. API 설계 (간단 경로)

### 8.1 REST + JWT

#### Reads
```
GET /cities/:id/overview
GET /nations/:id/dashboard
GET /map/tiles?bbox=...
GET /generals/:id
GET /rankings
GET /battles/logs?turn=N
```

#### Writes (Enqueue)
```
POST /orders/move
POST /orders/train
POST /orders/recruit
POST /orders/diplomacy
```

**응답:**
```json
{
  "accepted": true,
  "orderId": "...",
  "turnNumber": 1234
}
```

### 8.2 검증 & 보안
- Zod 스키마 검증
- JWT 세션
- Rate limit
- Idempotency-key (중복 제출 방지)

---

## 9. 테스트/검증 전략

### 9.1 단위 테스트
- 전투 수식
- 명령 검증
- RNG 결정성

### 9.2 회귀 테스트
- PHP 결과 대비 스냅샷
- 고정 입력/seed로 100% 일치 목표

### 9.3 시뮬레이션
- 가짜 월드로 N턴 자동 실행
- Invariants 체크

### 9.4 퍼포먼스
- 턴 처리 시간 SLA (예: 1분 내)
- 이벤트/프로젝션 처리량

### 9.5 롤백
- 특정 턴 재실행
- Snapshot + event replay

---

## 10. 위험 요소와 대응

### 10.1 규칙 불일치/밸런스 변형
**대응:**
- 결정적 RNG
- 공식 1:1 포팅
- 회귀 벤치마크

### 10.2 데이터 정합성
**대응:**
- Invariants 체크리스트
- 이중 운영 기간 동안 비교 대시보드

### 10.3 병행 운영 복잡도
**대응:**
- 단순 ETL (턴 경계 단위)
- 단일 권위 원칙 (쓰기는 한 시스템만)

### 10.4 퍼포먼스/메모리
**대응:**
- 이벤트 배치
- 프로젝션 인덱스
- Time-series 컬렉션
- 필요 시 샤딩

### 10.5 운영 사고 (데몬 중단)
**대응:**
- 리더 선출용 락 컬렉션
- 헬스체크
- Cold standby

### 10.6 보안/부정행위
**대응:**
- 서버측 검증 강화
- 속도 제한
- 감사 로그

---

## 11. 우선순위별 단계와 노력 추정

| 우선순위 | 작업 | 노력 |
|---------|------|------|
| P0 | 레포/스키마 분석, 핵심 흐름 식별, ETL PoC | Small |
| P1 | Read 모델 섀도 API (핵심 화면 3~5개) | Medium |
| P2 | 명령 Enqueue API + 대기열 UI | Medium |
| P3 | Node 턴 데몬 PoC (테스트 월드) | Large |
| P4 | 전투/명령 핵심 5개 이행 + 회귀 통과 | Large |
| P5 | 컷오버, 모니터링/롤백 준비 | Medium |

**전체 규모:** Large ~ X-Large (수주 ~ 수개월)

---

## 12. 간단한 코드 스켈레톤

### 12.1 이벤트/명령 타입

```typescript
// shared/types/command.ts
export interface Command {
  id: string;
  type: string;
  actorId: string;
  payload: object;
  turn: number;
}

// shared/types/event.ts
export interface DomainEvent {
  id: string;
  ts: Date;
  turn: number;
  aggregateType: string;
  aggregateId: string;
  type: string;
  version: number;
  payload: object;
}
```

### 12.2 데몬 처리 루프

```typescript
// daemon.ts (의사 코드)
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
  const turn = await beginTurn();
  
  const orders = await fetchPending(turn);
  
  for (const order of orders) {
    await validate(order);
    const events = await execute(order, state, rng);
    await appendEvents(events);
    await applyState(events);
    await updateProjections(events);
  }
  
  await endTurn(turn);
});
```

### 12.3 프로젝션 업데이트

```typescript
// projections/city-overview.ts
export async function onCityCaptured(event: CityCaptured) {
  await db.collection('projection_city_overview').updateOne(
    { cityId: event.cityId },
    {
      $set: {
        nationId: event.newOwner,
        garrison: event.garrison,
        lastBattleAt: event.ts
      }
    }
  );
}
```

### 12.4 인덱스 정의

```typescript
// MongoDB shell
db.orders.createIndex({ turn: 1, status: 1 })
db.events.createIndex(
  { aggregateType: 1, aggregateId: 1, version: 1 },
  { unique: true }
)
db.battleLogs.createIndex({ turn: 1, cityId: 1 })
```

---

## 13. 운영/관찰성

### 13.1 로깅
- pino (JSON 로그)
- 이벤트 카운터
- 턴 처리 시간

### 13.2 메트릭
- 처리된 명령 수
- 전투 수
- 프로젝션 지연 (ms)

### 13.3 알림
- 데몬 lease 상실/지연
- 프로젝션 랙 임계치 경보

### 13.4 백업
- events, snapshots 주기 백업
- battleLogs TTL/아카이브

---

## 14. 고급 경로 고려 시점

### 14.1 대규모 확장 필요 시
- 멀티 월드/대규모 동시 유저
- 월드별 데몬 샤딩
- Events 파티셔닝
- 프로젝션 파티션

### 14.2 이벤트 소싱 정교화
- Kafka/Redpanda로 이벤트 브로커 외부화

### 14.3 쿼리 복잡/고부하
- Elasticsearch/Redis 캐시 도입

---

## 부록 A: 확인해야 할 레포 지표 체크리스트

- [ ] DB 접속 위치/쿼리 수 (상위 50)
- [ ] 데몬 엔트리포인트 (턴 주기/락 방식)
- [ ] 전투/명령 핵심 함수와 상수 테이블
- [ ] 주요 화면의 쿼리 패턴
- [ ] 로그 테이블 용량/증가율

## 부록 B: Anti-Corruption Layer (병행 기간)

**MariaDB ↔ MongoDB 동기화 맵:**
- 국가/도시 소유권
- 자원 수치
- 장수/부대 배치
- 턴 경계 단위로 스냅샷 합의

---

## 마무리

**가장 단순한 성공 경로:**
- 단일 쓰기 데몬 + 이벤트 기반 읽기 모델
- Read → Write 순의 점진 이행
- 회귀 테스트로 리스크 감소
- 전투/명령 규칙의 결정성 보장이 핵심
