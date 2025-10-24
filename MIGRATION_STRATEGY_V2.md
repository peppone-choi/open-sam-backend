# 삼국지 게임 PHP → Node.js 마이그레이션 전략 (Redis 쓰기 버퍼 + MongoDB 영속)

## TL;DR
- **CQRS + Single Writer**: API 서버는 읽기 전용, 모든 쓰기는 단일 Game Daemon이 수행
- **2-Tier 캐시**: L1(node-cache, 3초 TTL, 읽기 전용) + L2(Redis, 쓰기 버퍼)
- **영속화 전략**: 실시간/핫 상태는 Redis에 먼저 기록, MongoDB는 주기적 배치로 영속화 (이벤트는 즉시 저장)
- **24배속 실시간**: 은하영웅전설7 스타일 시스템 (실제 1시간 = 게임 1일)

---

## 1. 현재 → 목표 아키텍처

### 1.1 현재 상태
- Mongoose + MongoDB 중심
- API가 직접 MongoDB 읽기/쓰기
- 게임 루프/전투 처리와 API 경합 가능
- 24배속 실시간에 비해 응답 지연 우려

### 1.2 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│          (Next.js / Mobile Future)                           │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/REST/WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│           API Server (Express.js, 읽기 전용, N개)            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        2-Tier Cache                                 │    │
│  │  L1: node-cache (3초 TTL, 프로세스 로컬)            │    │
│  │  L2: Redis (권위 있는 실시간 상태, 쓰기 버퍼)       │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────┬──────────────────────┬──────────────────────┘
                │ (Query)              │ (Command)
                │                      │
                ▼                      ▼
          ┌──────────┐          ┌──────────────┐
          │ MongoDB  │          │Redis Streams │
          │(영구저장)│          │ cmd:game     │
          └──────────┘          └──────┬───────┘
                ▲                      │
                │                      │ XREADGROUP
                │                      ▼
                │              ┌────────────────────────────┐
                │              │  Game Daemon (단일 Writer) │
                │              │  ┌──────────────────────┐  │
                │              │  │  GameLoop            │  │
                │              │  │  setInterval(1s)     │  │
                │              │  └──────────────────────┘  │
                │              │  ┌──────────────────────┐  │
                │              │  │ CommandProcessor     │  │
                │              │  │ (Redis Streams 소비) │  │
                │              │  └──────────────────────┘  │
                │              │  ┌──────────────────────┐  │
                │              │  │ StateManager         │  │
                │              │  │ (Redis 상태 관리)    │  │
                │              │  └──────────────────────┘  │
                │              │  ┌──────────────────────┐  │
                │              │  │ PersistScheduler     │  │
                │              │  │ node-cron(*/5분)     │  │
                │              │  └──────────────────────┘  │
                └──────────────┴────────────────────────────┘
```

**쓰기 경로:**
1. API는 명령을 Redis Streams(`cmd:game`)에 발행
2. Daemon이 소비, 검증/실행
3. 결과 상태를 Redis(L2)에 즉시 반영
4. 이벤트를 MongoDB에 즉시 기록
5. 상태 스냅샷/집계를 5분마다 MongoDB에 배치 저장

**읽기 경로:**
1. API는 L1(node-cache, 3초) 조회
2. L1 미스 → L2(Redis) 조회
3. L2 미스 → MongoDB 조회
4. 변경 시 Redis Pub/Sub로 L1 무효화

---

## 2. 은하영웅전설7 스타일 시스템

### 2.1 실시간 24배속 시간 시스템

```typescript
// shared/config/time-config.ts
export const TimeConfig = {
  GAME_SPEED: 24, // 24배속
  
  // 실시간 → 게임시간 변환
  toGameTime(realSeconds: number): number {
    return realSeconds * this.GAME_SPEED;
  },
  
  // 게임시간 → 실시간 변환
  toRealTime(gameSeconds: number): number {
    return gameSeconds / this.GAME_SPEED;
  }
};

// 예시
실시간 1초   = 게임 24초
실시간 1분   = 게임 24분
실시간 1시간 = 게임 1일
실시간 24시간 = 게임 24일
실시간 30일  = 게임 2년
```

### 2.2 게임 루프 (실시간 진행)

```typescript
// daemon/game-loop.ts
export class GameLoop {
  private tickInterval: NodeJS.Timeout;
  
  start() {
    // 1초마다 틱
    this.tickInterval = setInterval(async () => {
      await this.tick();
    }, 1000);
    
    console.log('🕐 Game loop started (24x speed)');
  }
  
  async tick() {
    const now = this.getGameTime();
    
    // 1. 커맨드 완료 확인
    await this.commandService.checkCompletion(now);
    
    // 2. 이동 업데이트
    await this.movementService.tick(now);
    
    // 3. 생산 업데이트
    await this.productionService.tick(now);
    
    // 4. 전투 업데이트
    await this.battleService.tick(now);
    
    // 5. 월간 이벤트 (세금 징수)
    if (this.isFirstDayOfMonth(now)) {
      await this.economyService.collectTaxes();
    }
    
    // 6. 자동 이벤트
    await this.triggerAutoEvents(now);
  }
  
  getGameTime(): Date {
    const elapsed = Date.now() - this.startTime;
    return new Date(elapsed * TimeConfig.GAME_SPEED);
  }
}
```

### 2.3 직책/권한 시스템

**직책 카드:**
- 황제 (Level 1): 모든 권한
- 승상 (Level 2): 임명/파면, 외교, 법령
- 대장군 (Level 3): 군사 명령, 전쟁 선포
- 군단장 (Level 4): 부대 편성/이동
- 태수 (Level 5): 도시 관리

**권한 예시:**
```typescript
interface Authorities {
  canAppoint: string[];      // 임명 가능 직책
  canDismiss: string[];      // 파면 가능 직책
  canDeclareWar: boolean;    // 선전포고
  canMakePeace: boolean;     // 강화
  canIssueLaw: boolean;      // 법령 제정
  cpMultiplier: number;      // CP 배수 (1.0 ~ 3.0)
}
```

**권한 체크:**
```typescript
function assertAuthority(general: General, cmdType: string) {
  const auth = general.position?.authorities || {};
  
  if (cmdType === 'DECLARE_WAR' && !auth.canDeclareWar) {
    throw new Error('권한 없음: 선전포고 권한 필요');
  }
}
```

### 2.4 커맨드 포인트 (PCP/MCP)

**PCP (Personal Command Point):**
- 개인 커맨드 포인트
- 이동, 훈련, 개인 행동에 소비
- 직책/능력치에 따라 최대치 증가

**MCP (Military Command Point):**
- 국가 커맨드 포인트
- 전쟁, 징병, 건설 등 국가 행동에 소비
- 직책/정책에 따라 배수 적용

```typescript
// 커맨드 비용 정의
const CommandCost = {
  MOVE: { pcp: 2, mcp: 0, time: 1800 },      // 이동: PCP 2, 30분
  TRAIN: { pcp: 5, mcp: 0, time: 3600 },     // 훈련: PCP 5, 1시간
  RECRUIT: { pcp: 0, mcp: 10, time: 7200 },  // 징병: MCP 10, 2시간
  BUILD: { pcp: 0, mcp: 20, time: 14400 },   // 건설: MCP 20, 4시간
};

// Redis LUA로 원자적 차감
async function reservePCP(redis: Redis, generalId: string, cost: number) {
  const script = `
    local key = KEYS[1]
    local cost = tonumber(ARGV[1])
    local pcp = tonumber(redis.call('HGET', key, 'pcp'))
    if pcp >= cost then
      redis.call('HINCRBY', key, 'pcp', -cost)
      return 1
    else
      return 0
    end
  `;
  
  const result = await redis.eval(
    script,
    1,
    `state:general:${generalId}`,
    cost
  );
  
  if (result === 0) {
    throw new Error('PCP 부족');
  }
}
```

### 2.5 RTS 전투 시스템

**별도 전투 엔진 (60 FPS):**
```typescript
// daemon/battle-engine.ts
export class BattleEngine {
  private battles = new Map<string, Battle>();
  
  start() {
    // 60 FPS 루프
    setInterval(() => {
      this.tick();
    }, 1000 / 60);
  }
  
  tick() {
    for (const [id, battle] of this.battles) {
      // AI 행동
      this.processAI(battle);
      
      // 물리/충돌
      this.updatePhysics(battle);
      
      // 전투 종료 체크
      if (this.isFinished(battle)) {
        this.endBattle(battle);
      }
    }
  }
  
  async endBattle(battle: Battle) {
    // Redis에 결과 기록
    await redis.hset(`state:battle:${battle.id}`, {
      status: 'FINISHED',
      winner: battle.winner,
      casualties: JSON.stringify(battle.casualties)
    });
    
    // MongoDB에 이벤트 즉시 저장
    await events.insertOne({
      type: 'BATTLE_ENDED',
      battleId: battle.id,
      winner: battle.winner,
      ts: new Date()
    });
    
    // Pub/Sub로 알림
    await redis.publish('channel:game:events', JSON.stringify({
      type: 'BATTLE_ENDED',
      battleId: battle.id
    }));
  }
}
```

### 2.6 오프라인 플레이

**캐릭터는 항상 월드에 존재:**
- 오프라인 시에도 이동/생산/전투 진행
- 안전 지대 보호 (1시간)
- AI 대리 플레이

```typescript
// daemon/offline-handler.ts
async function handleOfflineProtection(general: General) {
  const lastLogin = general.lastLoginAt;
  const now = Date.now();
  const offlineHours = (now - lastLogin) / 3600000;
  
  if (offlineHours < 1) {
    // 1시간 이내: 완전 보호
    general.isProtected = true;
  } else if (offlineHours < 24) {
    // 24시간 이내: AI 대리
    general.aiDelegate = true;
  } else {
    // 24시간 초과: 보호 없음
    general.isProtected = false;
    general.aiDelegate = false;
  }
}
```

---

## 3. Redis 쓰기 버퍼 전략

### 3.1 L1 캐시 (node-cache)

**용도:** 읽기 전용, 빠른 응답

```typescript
// infrastructure/cache/node-cache.service.ts
import NodeCache from 'node-cache';

export class L1CacheService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3, // 3초 TTL
      checkperiod: 1,
      useClones: false
    });
  }
  
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }
  
  set<T>(key: string, value: T): void {
    this.cache.set(key, value, 3);
  }
  
  del(key: string): void {
    this.cache.del(key);
  }
}
```

### 3.2 L2 캐시 (Redis) - 쓰기 버퍼

**용도:** 권위 있는 실시간 상태, 영속 이전의 게임 상태

**Key 패턴:**
```
state:general:{id}       # 장수 상태
state:city:{id}          # 도시 상태
state:nation:{id}        # 국가 상태
state:battle:{id}        # 전투 상태

idx:city:garrison:{cityId}        # 도시 주둔 장수 목록
set:nation:members:{nationId}     # 국가 멤버 목록

cmd:game                 # 커맨드 스트림

channel:cache:invalidate # 캐시 무효화 채널
channel:game:events      # 게임 이벤트 채널
```

**상태 예시:**
```json
// state:general:{id}
{
  "id": "g123",
  "ownerId": "p1",
  "nationId": "n1",
  "cityId": "c10",
  "pcp": 7,
  "pcpMax": 10,
  "mcp": 12,
  "mcpMax": 20,
  "position": {
    "name": "대장군",
    "level": 3,
    "cpMultiplier": 1.5
  },
  "status": "ACTIVE",
  "movement": {
    "from": "c10",
    "to": "c11",
    "eta": 1690000000
  },
  "updatedAt": 1690000000,
  "version": 345,
  "persistedVersion": 340
}
```

### 3.3 MongoDB - 영속 저장소

**즉시 저장: 이벤트 (append-only)**
```typescript
// events 컬렉션
{
  _id: ObjectId,
  ts: Date,
  type: String,              // 'BATTLE_ENDED', 'CITY_CAPTURED', etc
  aggregateType: String,     // 'battle', 'city', etc
  aggregateId: ObjectId,
  version: Number,
  payload: Object
}
```

**배치 저장: 상태 스냅샷 (5분마다)**
```typescript
// snapshots 컬렉션
{
  _id: ObjectId,
  type: String,              // 'general', 'city', etc
  refId: ObjectId,           // 참조 ID
  version: Number,
  state: Object,
  updatedAt: Date
}
```

**읽기 최적화: 프로젝션**
```typescript
// projection_city_overview 컬렉션
{
  cityId: ObjectId,
  nationId: ObjectId,
  garrison: Number,
  lastBattleAt: Date,
  updatedAt: Date
}
```

---

## 4. 데이터 흐름

### 4.1 명령 제출 (쓰기)

```
1. Client → API POST /api/commands
2. API: 권한/형식 검증
3. API → Redis XADD cmd:game
4. API → Client: 202 Accepted { orderId }
5. Daemon: XREADGROUP cmd:game
6. Daemon: 도메인 검증
7. Daemon → Redis: 상태 업데이트 (HSET state:*)
8. Daemon → MongoDB: 이벤트 즉시 저장
9. Daemon → Redis Pub/Sub: 캐시 무효화
10. Daemon → Redis: XACK
```

### 4.2 상태 조회 (읽기)

```
1. Client → API GET /api/generals/:id
2. API: L1 캐시 조회
3. L1 미스 → API: L2 Redis 조회 (HGETALL state:general:{id})
4. L2 미스 → API: MongoDB 조회 (snapshots)
5. API → L1: 캐싱 (3초 TTL)
6. API → Client: 200 OK { general }
```

### 4.3 영속화 (배치)

```
node-cron: */5 * * * * (5분마다)

1. Redis: 더티 키 스캔 (version > persistedVersion)
2. Daemon: state:* HGETALL
3. Daemon → MongoDB: snapshots.upsert
4. Daemon → Redis: persistedVersion = version
5. 로그: 영속화 완료 (keys=50, time=123ms)
```

---

## 5. 구현 코드

### 5.1 Redis 서비스

```typescript
// infrastructure/cache/redis.service.ts
import Redis from 'ioredis';

export class RedisService {
  private redis: Redis;
  private sub: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.sub = new Redis(process.env.REDIS_URL);
  }
  
  // Streams
  async xadd(stream: string, payload: any): Promise<string> {
    return this.redis.xadd(stream, '*', 'payload', JSON.stringify(payload));
  }
  
  async xreadgroup(
    group: string,
    consumer: string,
    streams: Record<string, string>,
    opts?: { COUNT?: number; BLOCK?: number }
  ): Promise<any> {
    return this.redis.xreadgroup(
      'GROUP', group, consumer,
      'COUNT', opts?.COUNT || 10,
      'BLOCK', opts?.BLOCK || 1000,
      'STREAMS', ...Object.entries(streams).flat()
    );
  }
  
  async xack(stream: string, group: string, id: string): Promise<number> {
    return this.redis.xack(stream, group, id);
  }
  
  // State
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }
  
  async hset(key: string, data: Record<string, any>): Promise<number> {
    return this.redis.hset(key, data);
  }
  
  // Pub/Sub
  subscribe(channel: string, handler: (msg: string) => void): void {
    this.sub.subscribe(channel);
    this.sub.on('message', (ch, msg) => {
      if (ch === channel) handler(msg);
    });
  }
  
  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }
}
```

### 5.2 영속화 스케줄러

```typescript
// daemon/persist-scheduler.ts
import cron from 'node-cron';

export class PersistScheduler {
  constructor(
    private redis: RedisService,
    private snapshotRepo: SnapshotRepository
  ) {}
  
  start() {
    // 5분마다 실행
    cron.schedule('*/5 * * * *', async () => {
      await this.flush();
    });
  }
  
  async flush() {
    console.log('🔄 Starting persist flush...');
    const startTime = Date.now();
    
    // 1. 더티 키 스캔
    const dirtyKeys = await this.scanDirtyKeys();
    
    console.log(`Found ${dirtyKeys.length} dirty keys`);
    
    // 2. 배치 저장
    for (const key of dirtyKeys) {
      try {
        const state = await this.redis.hgetall(key);
        
        await this.snapshotRepo.upsert({
          type: this.getTypeFromKey(key),
          refId: this.getIdFromKey(key),
          version: parseInt(state.version),
          state: JSON.parse(state.data || '{}'),
          updatedAt: new Date()
        });
        
        // persistedVersion 갱신
        await this.redis.hset(key, {
          persistedVersion: state.version
        });
        
      } catch (error) {
        console.error(`Failed to persist ${key}:`, error);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Persist flush complete (keys=${dirtyKeys.length}, time=${elapsed}ms)`);
  }
  
  private async scanDirtyKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const [newCursor, results] = await this.redis.scan(
        cursor,
        'MATCH', 'state:*',
        'COUNT', 100
      );
      
      cursor = newCursor;
      
      for (const key of results) {
        const state = await this.redis.hgetall(key);
        const version = parseInt(state.version || '0');
        const persistedVersion = parseInt(state.persistedVersion || '0');
        
        if (version > persistedVersion) {
          keys.push(key);
        }
      }
    } while (cursor !== '0');
    
    return keys;
  }
  
  private getTypeFromKey(key: string): string {
    return key.split(':')[1]; // state:general:{id} → general
  }
  
  private getIdFromKey(key: string): string {
    return key.split(':')[2]; // state:general:{id} → {id}
  }
}
```

### 5.3 캐시 미들웨어

```typescript
// api/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { L1CacheService } from '../../infrastructure/cache/node-cache.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

export function cacheMiddleware(ttl: number = 3) {
  const l1Cache = container.resolve(L1CacheService);
  const redis = container.resolve(RedisService);
  
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = `cache:${req.originalUrl}`;
    
    // L1 조회
    const l1Data = l1Cache.get(cacheKey);
    if (l1Data) {
      res.set('X-Cache', 'L1-HIT');
      return res.json(l1Data);
    }
    
    // L2 조회
    const l2Data = await redis.get(cacheKey);
    if (l2Data) {
      const parsed = JSON.parse(l2Data);
      l1Cache.set(cacheKey, parsed);
      res.set('X-Cache', 'L2-HIT');
      return res.json(parsed);
    }
    
    // 캐시 미스: 원본 응답 캐싱
    res.set('X-Cache', 'MISS');
    
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // 비동기로 L1/L2 캐싱
      l1Cache.set(cacheKey, data);
      redis.set(cacheKey, JSON.stringify(data), 'EX', ttl).catch(console.error);
      
      return originalJson(data);
    };
    
    next();
  };
}
```

---

## 6. 마이그레이션 단계

| 우선순위 | 작업 | 노력 |
|---------|------|------|
| P0 | Redis 연결 및 기본 키 스키마 확정 | Small |
| P1 | API 읽기 경로 L1/L2 경유로 변경 | Medium |
| P2 | 명령 제출 Redis Streams로 전환 | Medium |
| P3 | Game Daemon PoC (1s 루프, 기본 처리) | Large |
| P4 | Persist 스케줄러 (*/5분) 구현 | Medium |
| P5 | 직책/권한, PCP/MCP, RTS 전투 적용 | Large |
| P6 | 모니터링/알림/백업, 컷오버 | Medium |

**전체 규모:** Large ~ X-Large (수주 ~ 수개월)

---

## 7. 운영/관찰성

### 7.1 메트릭
- 처리 TPS (commands/sec)
- 루프 지연 (loop lag ms)
- Streams lag (pending messages)
- L1/L2 hit ratio (%)
- 영속 지연 (persist lag ms)

### 7.2 알림
- Daemon lease 상실/지연
- Streams 누적 (> 1000)
- 영속 지연 (> 10분)
- L2 캐시 미스율 (> 50%)

### 7.3 백업
- MongoDB: events/snapshots/projections 일일 백업
- Redis: RDB/AOF (선택, 상태 복구용이 아닌 캐시용)

---

## 8. 리스크와 가드레일

### 8.1 Redis 장애
- **대응:** MongoDB 스냅샷 + 이벤트 replay로 복구
- **가드레일:** Flush 주기 5분 (초기 1~2분 권장)

### 8.2 일관성 창
- **대응:** API가 Redis를 권위로 사용, MongoDB는 보고/이력용
- **가드레일:** L1 TTL 3초, Pub/Sub 무효화

### 8.3 권한/자원 경쟁
- **대응:** PCP/MCP 갱신은 Redis LUA로 원자 처리
- **가드레일:** 명령 멱등키 사용

---

## 9. 고급 경로

### 9.1 대규모 확장
- 월드별 스트림 파티션 (`cmd:game:{worldId}`)
- Daemon 샤딩 (월드별 또는 지역별)

### 9.2 전투 엔진 분리
- 워커 풀로 전투 처리
- 전투별 키 파티셔닝

### 9.3 영속 최적화
- 중요 상태는 즉시 MongoDB upsert
- 나머지만 배치 처리

---

## 10. 결론

**가장 단순하고 빠른 길:**
- 단일 Game Daemon이 Redis(L2)에 즉시 쓰기
- API는 L1/L2로 즉시 읽기
- MongoDB는 이벤트 즉시 + 상태 배치로 영속화

**이 구조의 장점:**
- 24배속 실시간 요구와 빠른 응답 충족
- 점진 이행과 안정적 롤백 가능
- 명확한 CQRS 분리와 Single Writer 보장
