# 백엔드 아키텍처 분석 및 완성 계획

**분석 일자:** 2025-11-01  
**프로젝트:** open-sam-backend (MongoDB + Redis CQRS)

---

## 🏗️ 현재 아키텍처 (발견된 설계)

### 핵심 설계 철학

```
Redis = Game STATE (Real-time)
MongoDB = Persistence (Historical)
```

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              API SERVER (Express.js)                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Read Queries                                      │     │
│  │  - GET /api/general/:id → Redis (L1 cache)        │     │
│  │  - GET /api/nation/:id  → Redis (L2 cache)        │     │
│  │  - GET /api/map         → Redis (cached)          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Write Commands                                    │     │
│  │  - POST /api/commands → Publish to Redis Stream   │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Redis Streams (game:commands)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              GAME DAEMON (Single Writer)                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Command Consumer                                  │     │
│  │  - Consume from Redis Stream                      │     │
│  │  - Execute command logic                          │     │
│  │  - Update Redis STATE                             │     │
│  │  - Persist to MongoDB (async)                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYERS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   L1 Cache   │  │   L2 Cache   │  │   L3 Store   │      │
│  │              │  │              │  │              │      │
│  │  NodeCache   │→│    Redis     │→│   MongoDB    │      │
│  │  (10초 TTL)  │  │  (60초 TTL)  │  │  (영구)      │      │
│  │              │  │              │  │              │      │
│  │  In-Memory   │  │  Game STATE  │  │  Persistence │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Redis 역할 (Game STATE)

### 1. Primary Game State Store

Redis는 **모든 실시간 게임 상태**를 저장합니다:

```typescript
// Redis Data Structure

// 1. General (장수) State
redis.hset('general:{generalId}', {
  no: 123,
  name: '조조',
  leadership: 95,
  strength: 87,
  intel: 92,
  gold: 5000,
  rice: 3000,
  city: 1,
  nation: 2,
  turntime: '2025-11-01T10:00:00Z',
  // ... 73 columns from schema.sql
})

// 2. Nation (국가) State
redis.hset('nation:{nationId}', {
  no: 2,
  name: '위',
  color: '#FF0000',
  gold: 50000,
  rice: 30000,
  gennum: 15,
  power: 8500,
  // ...
})

// 3. City (도시) State
redis.hset('city:{cityId}', {
  no: 1,
  name: '낙양',
  nation: 2,
  general: 123,
  defense: 80,
  wall: 90,
  agri: 75,
  comm: 85,
  tech: 70,
  // ...
})

// 4. Command Queue (명령 큐)
redis.zadd('general:{generalId}:commands', {
  score: turnIndex,
  member: JSON.stringify({
    type: 'TRAIN_SOLDIER',
    arg: { amount: 100 },
    turnIdx: 5
  })
})

// 5. Turn Processing Lock
redis.set('game:turn:lock', 'processing', 'EX', 60)

// 6. Real-time Map Cache
redis.setex('map:full', 60, JSON.stringify({
  cities: [...],
  nations: [...],
  generals: [...]
}))
```

### 2. Redis Streams for CQRS

```typescript
// Command Stream
XADD game:commands * 
  commandId "cmd-123"
  category "general"
  type "TRAIN_SOLDIER"
  generalId "123"
  sessionId "sangokushi_default"
  arg '{"amount":100}'
  timestamp "1730448000000"

// Consumer Group
XGROUP CREATE game:commands cmd-group 0 MKSTREAM

// Read from Stream
XREADGROUP GROUP cmd-group daemon-1 
  COUNT 10 
  BLOCK 1000 
  STREAMS game:commands >
```

### 3. TTL-based Cache Invalidation

```typescript
// 자동 만료로 최신 데이터 보장
redis.setex('general:123', 60, generalData)  // 60초 후 자동 삭제
redis.setex('nation:2:generals', 30, [...])  // 30초 후 자동 삭제
```

---

## 🗄️ MongoDB 역할 (Persistence)

MongoDB는 **영구 저장 및 히스토리**만 담당합니다:

```typescript
// 1. Command History (명령 기록)
db.commands.insertOne({
  _id: 'cmd-123',
  commandId: 'cmd-123',
  category: 'general',
  type: 'TRAIN_SOLDIER',
  generalId: 123,
  sessionId: 'sangokushi_default',
  arg: { amount: 100 },
  status: 'completed',
  result: { success: true, soldier: 100 },
  created_at: new Date(),
  completed_at: new Date()
})

// 2. Turn Snapshots (턴 스냅샷)
db.turnSnapshots.insertOne({
  sessionId: 'sangokushi_default',
  turnNumber: 1000,
  timestamp: new Date(),
  state: {
    generals: [...],
    nations: [...],
    cities: [...]
  }
})

// 3. Battle Logs (전투 기록)
db.battles.insertOne({
  battleId: 'battle-456',
  attacker: { generalId: 123, troops: 1000 },
  defender: { generalId: 456, troops: 800 },
  result: 'attacker_win',
  casualties: { attacker: 200, defender: 500 },
  log: [...],
  timestamp: new Date()
})

// 4. Hall of Fame (명예의 전당)
db.hallOfFame.insertOne({
  season: 1,
  generalId: 123,
  name: '조조',
  achievements: [...],
  finalStats: { ... }
})

// 5. User Records (유저 기록)
db.userRecords.insertOne({
  userId: 789,
  totalGamesPlayed: 15,
  totalWins: 8,
  totalKills: 234,
  favoriteGeneral: '조조'
})
```

### MongoDB 쓰기 시점

```typescript
// 1. Command 완료 시
async function executeCommand(command) {
  // Redis에서 읽기
  const general = await redis.hgetall(`general:${command.generalId}`)
  
  // Command 로직 실행
  general.gold -= 100
  general.soldier += 10
  
  // Redis에 쓰기 (즉시)
  await redis.hset(`general:${command.generalId}`, general)
  
  // MongoDB에 쓰기 (비동기, fire-and-forget)
  db.commands.updateOne(
    { commandId: command.commandId },
    { 
      $set: { 
        status: 'completed',
        result: { soldier: +10 },
        completed_at: new Date()
      }
    }
  ).catch(err => logger.error('MongoDB write failed', err))
  // ↑ 실패해도 게임 진행에 영향 없음
}

// 2. Turn 완료 시 (스냅샷)
async function onTurnComplete(turnNumber) {
  // Redis에서 전체 상태 읽기
  const state = await getAllGameState()
  
  // MongoDB에 스냅샷 저장 (비동기)
  db.turnSnapshots.insertOne({
    turnNumber,
    state,
    timestamp: new Date()
  }).catch(err => logger.error('Snapshot failed', err))
}

// 3. 게임 리셋/종료 시
async function onGameEnd() {
  // Redis 상태를 MongoDB로 완전 복사
  const finalState = await exportAllRedisState()
  await db.gameSessions.insertOne({
    sessionId: 'sangokushi_default',
    endedAt: new Date(),
    finalState
  })
  
  // Redis 클리어
  await redis.flushdb()
}
```

---

## 🔄 CQRS 패턴 상세

### Command Side (Write)

```typescript
// 1. API Server: Command 접수
POST /api/commands/train-soldier
{
  "generalId": 123,
  "amount": 100
}

// 2. Command 생성 및 발행
const command = {
  commandId: nanoid(),
  category: 'general',
  type: 'TRAIN_SOLDIER',
  generalId: 123,
  sessionId: 'sangokushi_default',
  arg: { amount: 100 },
  timestamp: Date.now()
}

// 3. Redis Stream에 발행
await commandQueue.publish(command)

// 4. 즉시 응답 (비동기 처리)
return { success: true, commandId: command.commandId }
```

### Query Side (Read)

```typescript
// 1. API Server: Query 접수
GET /api/general/123

// 2. 3-Layer 캐시 조회
async function getGeneral(id) {
  // L1: Memory Cache (10초)
  const cached = cacheManager.l1Cache.get(`general:${id}`)
  if (cached) return cached
  
  // L2: Redis (60초)
  const redisData = await redis.hgetall(`general:${id}`)
  if (redisData) {
    cacheManager.l1Cache.set(`general:${id}`, redisData)
    return redisData
  }
  
  // L3: MongoDB (fallback only)
  const dbData = await General.findOne({ no: id })
  if (dbData) {
    // Redis에 다시 채우기
    await redis.hset(`general:${id}`, dbData)
    cacheManager.l1Cache.set(`general:${id}`, dbData)
    return dbData
  }
  
  return null
}
```

### Event Processing (Daemon)

```typescript
// daemon.ts
while (!isShuttingDown) {
  // Redis Stream에서 Command 소비
  await commandQueue.consume('cmd-group', 'daemon-1', async (message) => {
    const { commandId, category, type, generalId, arg } = message
    
    try {
      // 1. Redis에서 현재 상태 읽기
      const general = await redis.hgetall(`general:${generalId}`)
      
      // 2. Command 실행 (비즈니스 로직)
      const result = await executeCommand(type, general, arg)
      
      // 3. Redis에 새 상태 쓰기 (즉시)
      await redis.hset(`general:${generalId}`, result.newState)
      
      // 4. MongoDB에 기록 (비동기)
      db.commands.updateOne(
        { commandId },
        { $set: { status: 'completed', result, completed_at: new Date() }}
      ).catch(err => logger.error('MongoDB write failed', err))
      
      // 5. ACK (메시지 처리 완료)
      return { success: true }
      
    } catch (error) {
      logger.error('Command execution failed', error)
      
      // 재시도 또는 DLQ로 이동
      throw error
    }
  })
}
```

---

## 📋 완성 필요 사항

### 1. Redis State Manager 구현

```typescript
// src/state/GameStateManager.ts

export class GameStateManager {
  private redis: Redis

  constructor() {
    this.redis = RedisService.getClient()
  }

  // General State
  async getGeneral(id: number) {
    return this.redis.hgetall(`general:${id}`)
  }

  async setGeneral(id: number, data: Partial<General>) {
    return this.redis.hset(`general:${id}`, data)
  }

  async updateGeneral(id: number, updates: Partial<General>) {
    return this.redis.hset(`general:${id}`, updates)
  }

  // Nation State
  async getNation(id: number) {
    return this.redis.hgetall(`nation:${id}`)
  }

  // City State
  async getCity(id: number) {
    return this.redis.hgetall(`city:${id}`)
  }

  // Bulk Operations
  async getAllGenerals() {
    const keys = await this.redis.keys('general:*')
    return Promise.all(keys.map(k => this.redis.hgetall(k)))
  }

  // Transaction Support
  async transaction(operations: () => Promise<void>) {
    const multi = this.redis.multi()
    await operations()
    return multi.exec()
  }
}
```

### 2. MongoDB Persistence Layer

```typescript
// src/persistence/PersistenceService.ts

export class PersistenceService {
  // Command 기록 저장
  async saveCommand(command: Command) {
    return db.commands.insertOne(command)
  }

  // Turn 스냅샷 저장
  async saveTurnSnapshot(turnNumber: number, state: GameState) {
    return db.turnSnapshots.insertOne({
      turnNumber,
      state,
      timestamp: new Date()
    })
  }

  // 게임 복구 (Redis 장애 시)
  async recoverFromMongoDB(sessionId: string) {
    // 최신 스냅샷 가져오기
    const snapshot = await db.turnSnapshots
      .findOne({ sessionId })
      .sort({ turnNumber: -1 })
    
    if (!snapshot) return null
    
    // Redis로 복구
    const stateManager = new GameStateManager()
    await stateManager.loadFromSnapshot(snapshot.state)
    
    return snapshot
  }
}
```

### 3. 턴 처리 시스템

```typescript
// src/daemon/TurnProcessor.ts

export class TurnProcessor {
  private stateManager: GameStateManager
  private persistenceService: PersistenceService

  async processTurn(turnNumber: number) {
    // 1. 락 획득
    const lockAcquired = await this.acquireTurnLock()
    if (!lockAcquired) {
      throw new Error('Turn lock already held')
    }

    try {
      // 2. 모든 General의 Command 실행
      const generals = await this.stateManager.getAllGenerals()
      
      for (const general of generals) {
        await this.executeGeneralTurn(general, turnNumber)
      }

      // 3. Nation 턴 처리
      const nations = await this.stateManager.getAllNations()
      
      for (const nation of nations) {
        await this.executeNationTurn(nation, turnNumber)
      }

      // 4. 스냅샷 저장 (MongoDB)
      await this.persistenceService.saveTurnSnapshot(
        turnNumber,
        await this.stateManager.exportFullState()
      )

      // 5. 턴 완료 브로드캐스트
      await this.broadcastTurnComplete(turnNumber)

    } finally {
      // 6. 락 해제
      await this.releaseTurnLock()
    }
  }

  private async acquireTurnLock(): Promise<boolean> {
    const result = await redis.set(
      'game:turn:lock',
      'processing',
      'EX', 60,  // 60초 TTL
      'NX'       // Not exists
    )
    return result === 'OK'
  }
}
```

### 4. 실시간 업데이트 (WebSocket)

```typescript
// src/realtime/GameEventEmitter.ts

export class GameEventEmitter {
  private io: Server

  // 상태 변경 시 클라이언트에 브로드캐스트
  async onGeneralUpdated(generalId: number, changes: Partial<General>) {
    this.io.to(`general:${generalId}`).emit('general:updated', {
      generalId,
      changes
    })
  }

  async onTurnComplete(turnNumber: number) {
    this.io.emit('turn:complete', {
      turnNumber,
      nextTurnAt: new Date(Date.now() + 10 * 60 * 1000) // 10분 후
    })
  }

  async onBattleStart(battleId: string, participants: number[]) {
    participants.forEach(generalId => {
      this.io.to(`general:${generalId}`).emit('battle:start', {
        battleId
      })
    })
  }
}
```

---

## 🎯 마이그레이션 전략

### Phase 1: Redis State Layer 구축 (Week 1)

```bash
# 1. GameStateManager 구현
touch src/state/GameStateManager.ts
touch src/state/types.ts

# 2. Redis 초기화 스크립트
touch src/scripts/init-redis-state.ts

# 3. MongoDB → Redis 마이그레이션 도구
touch src/scripts/migrate-to-redis.ts
```

### Phase 2: Command System 완성 (Week 2)

```bash
# 이미 97개 Command 클래스 존재
# Redis State를 사용하도록 수정

# src/commands/general/*.ts 수정
- MongoDB General.findOne() 제거
+ GameStateManager.getGeneral() 사용
```

### Phase 3: Persistence Layer (Week 3)

```bash
# MongoDB를 히스토리 전용으로 전환
touch src/persistence/PersistenceService.ts
touch src/persistence/SnapshotService.ts
```

### Phase 4: Turn Processing (Week 4)

```bash
# 턴 처리 시스템 완성
touch src/daemon/TurnProcessor.ts
touch src/daemon/SchedulerService.ts
```

---

## ✅ 현재 상태 vs 완성 상태

| 컴포넌트 | 현재 | 필요 | 우선순위 |
|----------|------|------|----------|
| **Redis 연결** | ✅ 완료 | - | - |
| **Redis Streams** | ✅ 완료 | - | - |
| **Command Queue** | ✅ 완료 | - | - |
| **3-Layer Cache** | ✅ 완료 | - | - |
| **Command Classes** | ✅ 97개 | Redis 연동 | P0 |
| **GameStateManager** | ❌ 없음 | 새로 작성 | P0 |
| **TurnProcessor** | ⏳ 일부 | 완성 필요 | P0 |
| **PersistenceService** | ❌ 없음 | 새로 작성 | P1 |
| **WebSocket Events** | ⏳ 구조만 | 구현 필요 | P1 |
| **Recovery System** | ❌ 없음 | 새로 작성 | P2 |

---

## 🚀 즉시 시작 작업

### Day 1-2: GameStateManager 구현

```typescript
// src/state/GameStateManager.ts
import { Redis } from 'ioredis'
import { RedisService } from '../infrastructure/queue/redis.service'
import { General, Nation, City } from '../types'

export class GameStateManager {
  private redis: Redis

  constructor() {
    this.redis = RedisService.getClient()
  }

  // === General State ===
  async getGeneral(id: number): Promise<General | null> {
    const data = await this.redis.hgetall(`general:${id}`)
    if (Object.keys(data).length === 0) return null
    return this.deserializeGeneral(data)
  }

  async setGeneral(general: General): Promise<void> {
    await this.redis.hset(
      `general:${general.no}`,
      this.serializeGeneral(general)
    )
    // TTL 설정 (1시간)
    await this.redis.expire(`general:${general.no}`, 3600)
  }

  async updateGeneral(id: number, updates: Partial<General>): Promise<void> {
    await this.redis.hset(`general:${id}`, this.serializeGeneral(updates))
  }

  async getAllGenerals(): Promise<General[]> {
    const keys = await this.redis.keys('general:*')
    const generals = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.hgetall(key)
        return this.deserializeGeneral(data)
      })
    )
    return generals.filter(g => g !== null) as General[]
  }

  // === Nation State ===
  async getNation(id: number): Promise<Nation | null> {
    const data = await this.redis.hgetall(`nation:${id}`)
    if (Object.keys(data).length === 0) return null
    return this.deserializeNation(data)
  }

  async setNation(nation: Nation): Promise<void> {
    await this.redis.hset(
      `nation:${nation.no}`,
      this.serializeNation(nation)
    )
    await this.redis.expire(`nation:${nation.no}`, 3600)
  }

  // === City State ===
  async getCity(id: number): Promise<City | null> {
    const data = await this.redis.hgetall(`city:${id}`)
    if (Object.keys(data).length === 0) return null
    return this.deserializeCity(data)
  }

  // === Serialization Helpers ===
  private serializeGeneral(general: Partial<General>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(general)) {
      if (typeof value === 'object') {
        result[key] = JSON.stringify(value)
      } else {
        result[key] = String(value)
      }
    }
    return result
  }

  private deserializeGeneral(data: Record<string, string>): General {
    // Convert string values back to proper types
    return {
      no: parseInt(data.no),
      name: data.name,
      leadership: parseInt(data.leadership),
      strength: parseInt(data.strength),
      intel: parseInt(data.intel),
      gold: parseInt(data.gold),
      rice: parseInt(data.rice),
      // ... 나머지 필드
    } as General
  }

  // Similar for Nation and City...
}
```

### Day 3-4: Command 클래스 Redis 연동

```typescript
// src/commands/general/trainSoldier.ts (기존 파일 수정)

import { GeneralCommand } from '../base/GeneralCommand'
import { GameStateManager } from '../../state/GameStateManager'

export class TrainSoldierCommand extends GeneralCommand {
  private stateManager = new GameStateManager()

  async execute() {
    // 기존: MongoDB에서 조회
    // const general = await General.findOne({ no: this.generalId })
    
    // 수정: Redis에서 조회
    const general = await this.stateManager.getGeneral(this.generalId)
    
    if (!general) {
      throw new Error('장수를 찾을 수 없습니다')
    }

    // 검증
    if (general.gold < 100) {
      throw new Error('금이 부족합니다')
    }

    // 상태 업데이트
    await this.stateManager.updateGeneral(this.generalId, {
      gold: general.gold - 100,
      soldier: (general.soldier || 0) + 10
    })

    return {
      success: true,
      result: { soldier: +10 }
    }
  }
}
```

---

## 📖 결론

**백엔드 아키텍처는 이미 훌륭하게 설계되어 있습니다!**

✅ **유지할 것:**
- MongoDB + Redis CQRS 패턴
- Redis = Game STATE (실시간)
- MongoDB = Persistence (히스토리)
- Redis Streams (Command Queue)
- 3-Layer Cache
- 97개 Command 클래스

🔨 **완성할 것:**
- GameStateManager (Redis 래퍼)
- Command 클래스들의 Redis 연동
- TurnProcessor 완성
- PersistenceService
- WebSocket 이벤트

⏱️ **예상 소요 시간:** 2주

다음 단계: GameStateManager 구현 시작하시겠습니까?
