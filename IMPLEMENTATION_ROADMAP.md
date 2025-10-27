# 구현 로드맵 - 삼국지 게임 백엔드

## 📊 현재 상태 (2025-01-24)

### ✅ 완료된 작업
- [x] package.json 설정 (Express, Mongoose, node-cron)
- [x] tsconfig.json 설정
- [x] 기본 Express 서버 (src/server.ts)
- [x] 기본 Cron 데몬 (src/daemon.ts)
- [x] MongoDB 연결 (src/db/connection.ts)
- [x] 7개 Mongoose 스키마 정의
  - general.schema.ts
  - city.schema.ts
  - nation.schema.ts
  - battle.schema.ts
  - command.schema.ts
  - item.schema.ts
  - special-ability.schema.ts
- [x] 4개 기본 Repository
  - general.repository.ts
  - city.repository.ts
  - nation.repository.ts
  - command.repository.ts
- [x] 기본 Logger (src/shared/logger.ts)

---

## 🎯 다음 단계 (우선순위 순)

### Phase 1: Redis 및 캐시 인프라 (P0)

#### 1.1 Redis 의존성 설치
```bash
npm install ioredis
npm install --save-dev @types/ioredis
```

#### 1.2 파일 생성 목록
```
src/infrastructure/cache/
├── redis.service.ts           # Redis 연결 및 기본 작업
├── l1-cache.service.ts        # node-cache 래퍼
└── cache-manager.ts           # 2-Tier 통합
```

#### 1.3 구현 내용

**src/infrastructure/cache/redis.service.ts**
```typescript
import Redis from 'ioredis';

export class RedisService {
  private redis: Redis;
  private subscriber: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  // State 관리
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hset(key: string, data: Record<string, any>): Promise<number> {
    return this.redis.hset(key, data);
  }

  async hincrby(key: string, field: string, value: number): Promise<number> {
    return this.redis.hincrby(key, field, value);
  }

  // Streams (명령 큐)
  async xadd(stream: string, data: Record<string, any>): Promise<string> {
    return this.redis.xadd(stream, '*', 'payload', JSON.stringify(data));
  }

  async xreadgroup(
    group: string,
    consumer: string,
    streams: Record<string, string>,
    opts?: { COUNT?: number; BLOCK?: number }
  ): Promise<any> {
    const args = [
      'GROUP', group, consumer,
      'COUNT', opts?.COUNT || 10,
      'BLOCK', opts?.BLOCK || 1000,
      'STREAMS', ...Object.entries(streams).flat()
    ];
    return this.redis.xreadgroup(...args);
  }

  async xack(stream: string, group: string, id: string): Promise<number> {
    return this.redis.xack(stream, group, id);
  }

  // Pub/Sub
  subscribe(channel: string, handler: (message: string) => void): void {
    this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) handler(msg);
    });
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }

  // Atomic operations (LUA)
  async reservePCP(generalId: string, cost: number): Promise<boolean> {
    const script = `
      local key = KEYS[1]
      local cost = tonumber(ARGV[1])
      local pcp = tonumber(redis.call('HGET', key, 'pcp') or 0)
      if pcp >= cost then
        redis.call('HINCRBY', key, 'pcp', -cost)
        return 1
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(
      script,
      1,
      `state:general:${generalId}`,
      cost
    ) as number;
    
    return result === 1;
  }
}
```

**src/infrastructure/cache/l1-cache.service.ts**
```typescript
import NodeCache from 'node-cache';

export class L1CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3,           // 3초 TTL
      checkperiod: 1,      // 1초마다 만료 체크
      useClones: false     // 성능 최적화
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl: number = 3): void {
    this.cache.set(key, value, ttl);
  }

  del(key: string): void {
    this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }
}
```

**src/infrastructure/cache/cache-manager.ts**
```typescript
import { L1CacheService } from './l1-cache.service';
import { RedisService } from './redis.service';

export class CacheManager {
  private l1: L1CacheService;
  private l2: RedisService;

  constructor() {
    this.l1 = new L1CacheService();
    this.l2 = new RedisService();
    
    // L1 무효화 구독
    this.l2.subscribe('channel:cache:invalidate', (key) => {
      this.l1.del(key);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 조회
    const l1Data = this.l1.get<T>(key);
    if (l1Data) return l1Data;

    // L2 조회 (Redis)
    const l2Data = await this.l2.hgetall(key);
    if (l2Data && Object.keys(l2Data).length > 0) {
      const parsed = JSON.parse(l2Data.data || '{}') as T;
      this.l1.set(key, parsed);
      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3): Promise<void> {
    // L1 캐싱
    this.l1.set(key, value, ttl);

    // L2 저장 (Redis)
    await this.l2.hset(key, {
      data: JSON.stringify(value),
      updatedAt: Date.now().toString(),
      version: (Date.now()).toString()
    });
  }

  async invalidate(key: string): Promise<void> {
    // L1 삭제
    this.l1.del(key);

    // 다른 API 서버들에 L1 무효화 알림
    await this.l2.publish('channel:cache:invalidate', key);
  }
}
```

---

### Phase 2: API 라우터 및 컨트롤러 (P1)

#### 2.1 파일 생성 목록
```
src/api/
├── routes/
│   ├── general.routes.ts
│   ├── city.routes.ts
│   ├── command.routes.ts
│   └── index.ts
├── controllers/
│   ├── general.controller.ts
│   ├── city.controller.ts
│   └── command.controller.ts
├── middleware/
│   ├── cache.middleware.ts
│   └── error.middleware.ts
└── dto/
    ├── command.dto.ts
    └── response.dto.ts
```

#### 2.2 구현 예시

**src/api/routes/general.routes.ts**
```typescript
import { Router } from 'express';
import { GeneralController } from '../controllers/general.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();
const controller = new GeneralController();

// 장수 조회 (캐싱)
router.get('/:id', cacheMiddleware(3), controller.getById);

// 장수 목록
router.get('/', cacheMiddleware(3), controller.getList);

// 장수 훈련 명령 제출
router.post('/:id/train', controller.submitTrain);

// 장수 이동 명령 제출
router.post('/:id/move', controller.submitMove);

export default router;
```

**src/api/controllers/general.controller.ts**
```typescript
import { Request, Response } from 'express';
import { GeneralRepository } from '../../db/repositories/general.repository';
import { RedisService } from '../../infrastructure/cache/redis.service';

export class GeneralController {
  private repository = new GeneralRepository();
  private redis = new RedisService();

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const general = await this.repository.findById(id);
      
      if (!general) {
        return res.status(404).json({ error: 'General not found' });
      }
      
      res.json({ general });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getList(req: Request, res: Response) {
    try {
      const { limit = 20, skip = 0 } = req.query;
      
      const generals = await this.repository.findAll(
        Number(limit),
        Number(skip)
      );
      
      res.json({ generals, count: generals.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async submitTrain(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { statType } = req.body; // 'command' | 'strength' | 'intelligence'
      
      // Redis Streams에 명령 발행
      const commandId = await this.redis.xadd('cmd:game', {
        type: 'TRAIN_GENERAL',
        generalId: id,
        statType,
        submittedAt: Date.now()
      });
      
      res.status(202).json({
        accepted: true,
        commandId,
        message: '명령이 제출되었습니다.'
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async submitMove(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { targetCityId } = req.body;
      
      const commandId = await this.redis.xadd('cmd:game', {
        type: 'MOVE_GENERAL',
        generalId: id,
        targetCityId,
        submittedAt: Date.now()
      });
      
      res.status(202).json({
        accepted: true,
        commandId,
        message: '이동 명령이 제출되었습니다.'
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

**src/api/middleware/cache.middleware.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { CacheManager } from '../../infrastructure/cache/cache-manager';

const cacheManager = new CacheManager();

export function cacheMiddleware(ttl: number = 3) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      res.set('X-Cache', 'MISS');

      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        cacheManager.set(cacheKey, data, ttl).catch(console.error);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}
```

**src/api/routes/index.ts**
```typescript
import { Router } from 'express';
import generalRoutes from './general.routes';
import cityRoutes from './city.routes';
import commandRoutes from './command.routes';

const router = Router();

router.use('/generals', generalRoutes);
router.use('/cities', cityRoutes);
router.use('/commands', commandRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;
```

**src/server.ts 업데이트**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import routes from './api/routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Start server
async function start() {
  try {
    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

---

### Phase 3: Game Daemon 게임 루프 (P3)

#### 3.1 파일 생성 목록
```
src/daemon/
├── game-loop.ts               # 메인 게임 루프 (1초 tick)
├── command-processor.ts       # Redis Streams 명령 처리
├── handlers/
│   ├── train.handler.ts       # 훈련 처리
│   ├── move.handler.ts        # 이동 처리
│   └── battle.handler.ts      # 전투 처리
└── persist-scheduler.ts       # 영속화 스케줄러
```

#### 3.2 구현 예시

**src/daemon/game-loop.ts**
```typescript
import { RedisService } from '../infrastructure/cache/redis.service';
import { CommandProcessor } from './command-processor';

export class GameLoop {
  private redis: RedisService;
  private processor: CommandProcessor;
  private startTime: number;
  private isRunning = false;

  constructor() {
    this.redis = new RedisService();
    this.processor = new CommandProcessor();
    this.startTime = Date.now();
  }

  start() {
    this.isRunning = true;
    console.log('🕐 Game loop started (24x speed)');

    // 1초마다 틱
    setInterval(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, 1000);
  }

  stop() {
    this.isRunning = false;
    console.log('⏸️ Game loop stopped');
  }

  private async tick() {
    try {
      const now = this.getGameTime();

      // 1. 커맨드 완료 확인
      await this.checkCommandCompletion(now);

      // 2. 이동 업데이트
      await this.updateMovements(now);

      // 3. 생산 업데이트
      await this.updateProductions(now);

      // 4. 자동 회복 (PCP/MCP)
      await this.recoverCP(now);

      // 5. 월간 이벤트 (세금)
      if (this.isFirstDayOfMonth(now)) {
        await this.collectTaxes();
      }
    } catch (error) {
      console.error('Game loop tick error:', error);
    }
  }

  private getGameTime(): Date {
    const elapsed = Date.now() - this.startTime;
    return new Date(elapsed * 24); // 24배속
  }

  private async checkCommandCompletion(now: Date) {
    // TODO: 완료된 커맨드 처리
  }

  private async updateMovements(now: Date) {
    // TODO: 이동 중인 장수 업데이트
  }

  private async updateProductions(now: Date) {
    // TODO: 생산 중인 항목 업데이트
  }

  private async recoverCP(now: Date) {
    // TODO: PCP/MCP 자동 회복
  }

  private isFirstDayOfMonth(date: Date): boolean {
    return date.getDate() === 1;
  }

  private async collectTaxes() {
    console.log('💰 Collecting monthly taxes...');
    // TODO: 세금 징수
  }
}
```

**src/daemon/command-processor.ts**
```typescript
import { RedisService } from '../infrastructure/cache/redis.service';
import { TrainHandler } from './handlers/train.handler';
import { MoveHandler } from './handlers/move.handler';

export class CommandProcessor {
  private redis: RedisService;
  private trainHandler: TrainHandler;
  private moveHandler: MoveHandler;
  private isRunning = false;

  constructor() {
    this.redis = new RedisService();
    this.trainHandler = new TrainHandler();
    this.moveHandler = new MoveHandler();
  }

  async start() {
    this.isRunning = true;
    console.log('🔄 Command processor started');

    // Consumer Group 생성
    try {
      await this.redis.xgroupCreate('cmd:game', 'game-daemon', '0', {
        MKSTREAM: true
      });
    } catch (error) {
      // Group already exists
    }

    // 명령 폴링
    this.poll();
  }

  stop() {
    this.isRunning = false;
    console.log('⏸️ Command processor stopped');
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const messages = await this.redis.xreadgroup(
          'game-daemon',
          'consumer-1',
          { 'cmd:game': '>' },
          { COUNT: 10, BLOCK: 1000 }
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [id, data] of streamMessages) {
              await this.processCommand(id, data);
            }
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processCommand(id: string, data: any) {
    try {
      const command = JSON.parse(data.payload);

      console.log(`Processing command: ${command.type} (${id})`);

      switch (command.type) {
        case 'TRAIN_GENERAL':
          await this.trainHandler.handle(command);
          break;

        case 'MOVE_GENERAL':
          await this.moveHandler.handle(command);
          break;

        default:
          console.warn(`Unknown command type: ${command.type}`);
      }

      // ACK
      await this.redis.xack('cmd:game', 'game-daemon', id);

    } catch (error) {
      console.error(`Error processing command ${id}:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**src/daemon/handlers/train.handler.ts**
```typescript
import { RedisService } from '../../infrastructure/cache/redis.service';
import { GeneralRepository } from '../../db/repositories/general.repository';
import { EventModel } from '../../db/schemas';

export class TrainHandler {
  private redis = new RedisService();
  private repository = new GeneralRepository();

  async handle(command: any) {
    const { generalId, statType } = command;

    // 1. PCP 차감 (원자적)
    const reserved = await this.redis.reservePCP(generalId, 5);
    if (!reserved) {
      throw new Error('PCP 부족');
    }

    // 2. 장수 정보 조회
    const general = await this.repository.findById(generalId);
    if (!general) {
      throw new Error('장수를 찾을 수 없습니다');
    }

    // 3. 스탯 증가
    switch (statType) {
      case 'command':
        general.command += 1;
        break;
      case 'strength':
        general.strength += 1;
        break;
      case 'intelligence':
        general.intelligence += 1;
        break;
    }

    // 4. Redis에 상태 업데이트
    await this.redis.hset(`state:general:${generalId}`, {
      [statType]: general[statType].toString(),
      version: Date.now().toString(),
      updatedAt: Date.now().toString()
    });

    // 5. MongoDB에 이벤트 즉시 저장
    await EventModel.create({
      type: 'GENERAL_TRAINED',
      aggregateType: 'general',
      aggregateId: generalId,
      payload: {
        statType,
        newValue: general[statType]
      },
      ts: new Date()
    });

    // 6. 캐시 무효화
    await this.redis.publish('channel:cache:invalidate', `cache:general:${generalId}`);

    console.log(`✅ General ${generalId} trained ${statType}`);
  }
}
```

**src/daemon.ts 업데이트**
```typescript
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { GameLoop } from './daemon/game-loop';
import { CommandProcessor } from './daemon/command-processor';

dotenv.config();

async function start() {
  try {
    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);

    // Game Loop 시작
    const gameLoop = new GameLoop();
    gameLoop.start();

    // Command Processor 시작
    const processor = new CommandProcessor();
    await processor.start();

    console.log('✅ Game Daemon started');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      gameLoop.stop();
      processor.stop();
      await mongoConnection.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start daemon:', error);
    process.exit(1);
  }
}

start();
```

---

### Phase 4: 영속화 스케줄러 (P4)

**src/daemon/persist-scheduler.ts**
```typescript
import cron from 'node-cron';
import { RedisService } from '../infrastructure/cache/redis.service';
import { GeneralModel, CityModel } from '../db/schemas';

export class PersistScheduler {
  private redis = new RedisService();

  start() {
    // 5분마다 실행
    cron.schedule('*/5 * * * *', async () => {
      await this.flush();
    });

    console.log('📅 Persist scheduler started (every 5 minutes)');
  }

  private async flush() {
    console.log('🔄 Starting persist flush...');
    const startTime = Date.now();

    try {
      // 1. 더티 키 스캔
      const dirtyKeys = await this.scanDirtyKeys();
      
      console.log(`Found ${dirtyKeys.length} dirty keys`);

      // 2. 배치 저장
      for (const key of dirtyKeys) {
        await this.persistKey(key);
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ Persist flush complete (keys=${dirtyKeys.length}, time=${elapsed}ms)`);

    } catch (error) {
      console.error('Persist flush error:', error);
    }
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

  private async persistKey(key: string): Promise<void> {
    try {
      const [, type, id] = key.split(':'); // state:general:{id}
      const state = await this.redis.hgetall(key);

      switch (type) {
        case 'general':
          await GeneralModel.findByIdAndUpdate(id, JSON.parse(state.data || '{}'));
          break;
        case 'city':
          await CityModel.findByIdAndUpdate(id, JSON.parse(state.data || '{}'));
          break;
      }

      // persistedVersion 갱신
      await this.redis.hset(key, {
        persistedVersion: state.version
      });

    } catch (error) {
      console.error(`Failed to persist ${key}:`, error);
    }
  }
}
```

---

## 📝 환경 변수 설정

**.env**
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/sangokushi

# Redis
REDIS_URL=redis://localhost:6379

# Game Config
GAME_SPEED=24
```

---

## 🚀 실행 방법

### 개발 모드
```bash
# Terminal 1: API 서버
npm run dev

# Terminal 2: Game Daemon
npm run dev:daemon
```

### 빌드 및 프로덕션
```bash
npm run build
npm start              # API 서버
npm run start:daemon   # Game Daemon
```

---

## 🧪 테스트

### API 테스트
```bash
# Health check
curl http://localhost:3000/api/health

# 장수 조회
curl http://localhost:3000/api/generals/{id}

# 훈련 명령 제출
curl -X POST http://localhost:3000/api/generals/{id}/train \
  -H "Content-Type: application/json" \
  -d '{"statType": "command"}'
```

---

## 📊 체크리스트

### Phase 1: Redis & Cache
- [ ] Redis 설치 및 연결 테스트
- [ ] RedisService 구현
- [ ] L1CacheService 구현
- [ ] CacheManager 구현 및 테스트

### Phase 2: API
- [ ] General Routes 구현
- [ ] City Routes 구현
- [ ] Command Routes 구현
- [ ] Cache Middleware 적용
- [ ] Error Middleware 구현

### Phase 3: Game Daemon
- [ ] GameLoop 구현 (1초 tick)
- [ ] CommandProcessor 구현 (Streams 소비)
- [ ] TrainHandler 구현
- [ ] MoveHandler 구현
- [ ] Event 저장 확인

### Phase 4: Persistence
- [ ] PersistScheduler 구현 (5분 cron)
- [ ] 더티 키 스캔 로직
- [ ] 배치 저장 로직
- [ ] 영속화 검증

---

## 🎯 다음 단계

Phase 1-4 완료 후:
- [ ] 직책/권한 시스템
- [ ] PCP/MCP 회복 시스템
- [ ] 이동 시스템 (경로, ETA)
- [ ] 전투 시스템 (RTS 엔진)
- [ ] 모니터링/로깅
- [ ] 테스트 코드 작성
