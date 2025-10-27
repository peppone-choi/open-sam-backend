# 삼국지 게임 마이그레이션 완전 문서 (Express.js 버전)

> **PHP + MySQL → Express.js + PostgreSQL + Redis**  
> **완전 정규화 + 하드코딩 제거 (236+ PHP 파일 → 7개 엔티티)**

---

**문서 작성일**: 2025-10-22  
**버전**: Express.js Edition 1.0  
**기술 스택**: Node.js + Express.js + TypeScript + Prisma/TypeORM

---

## 📚 목차

### PART 1: 개요 및 Spring Boot와의 차이점
### PART 2: Express.js 아키텍처
### PART 3: 구현 가이드
### PART 4: 엔티티 설계 (Prisma/TypeORM)

---

# PART 1: 개요

## 1.1 프로젝트 요약

레거시 PHP 삼국지 게임을 **Express.js + TypeScript** 기반 현대적 아키텍처로 완전 재구축

### 핵심 목표

✅ **하드코딩 제거**: 236+ PHP 파일 → 7개 DB 엔티티 (97% 감소)  
✅ **JSONB 정규화**: 동적 JSON → 타입 안전 컬럼/테이블  
✅ **동시성 해결**: 단일 Writer (Game Daemon) + 이벤트 기반 아키텍처  
✅ **성능 극대화**: 2-Tier 캐시 (node-cache + Redis)

---

## 1.2 Spring Boot vs Express.js 주요 차이점

| 항목 | Spring Boot | Express.js |
|------|-------------|------------|
| **언어** | Java | TypeScript/JavaScript |
| **프레임워크** | Spring Boot + JPA | Express + Prisma/TypeORM |
| **캐시** | Caffeine + Redis | node-cache + Redis |
| **DI** | Spring Container | tsyringe / InversifyJS |
| **검증** | Spring Validation | class-validator / joi |
| **스케줄러** | @Scheduled | node-cron / Bull |
| **비동기** | CompletableFuture | Promise / async-await |
| **ORM** | JPA + Querydsl | Prisma / TypeORM |

---

## 1.3 기술 스택

**Backend**:
- Runtime: Node.js 20+
- Framework: Express.js 4.x
- Language: TypeScript 5+
- ORM: Prisma 5+ (권장) 또는 TypeORM
- Database: PostgreSQL 16
- Cache: node-cache + Redis 7
- Queue: Bull / BullMQ
- Validation: class-validator + class-transformer
- DI: tsyringe 또는 InversifyJS

**Frontend**: Next.js 14, Phaser 3, Zustand, TailwindCSS  
**Infra**: Docker Compose, PM2, Prometheus, Grafana

---

# PART 2: Express.js 아키텍처

## 2.1 전체 아키텍처 (CQRS + Single Writer)

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│          (Next.js / Vue.js / Mobile Future)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/REST/WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│           API Server (Express.js, 읽기 전용, N개)            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        2-Level Cache (node-cache + Redis)           │    │
│  │  L1: node-cache (3초 TTL, 로컬 인메모리)            │    │
│  │  L2: Redis      (영구 캐시)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  - GeneralRouter (조회 + 커맨드 발행)                       │
│  - CityRouter                                                │
│  - BattleRouter                                              │
└───────────────┬──────────────────────┬──────────────────────┘
                │ (Query)              │ (Command)
                │                      │
                ▼                      ▼
          ┌──────────┐          ┌──────────────┐
          │PostgreSQL│          │Redis Streams │
          │(영구저장)│          │ cmd:game     │
          └──────────┘          └──────┬───────┘
                ▲                      │
                │                      │ poll (100ms)
                │                      ▼
                │              ┌────────────────────────────┐
                │              │  Game Daemon (단일 Writer) │
                │              │  Node.js Worker Process    │
                │              │  ┌──────────────────────┐  │
                │              │  │  GameLoopRunner      │  │
                │              │  │  setInterval(100ms)  │  │
                │              │  └──────────────────────┘  │
                │              │                            │
                │              │  ┌──────────────────────┐  │
                │              │  │ GameStateManager     │  │
                │              │  │ (인메모리 핫 데이터) │  │
                │              │  └──────────────────────┘  │
                │              │                            │
                │              │  ┌──────────────────────┐  │
                │              │  │ CommandProcessor     │  │
                │              │  │ ├─ TurnHandler       │  │
                │              │  │ ├─ BattleHandler     │  │
                │              │  │ └─ EventPublisher    │  │
                │              │  └──────────────────────┘  │
                └──────────────┴────────────────────────────┘
```

---

## 2.2 프로젝트 구조 (Express.js + TypeScript)

```
sangokushi-backend/
├── src/
│   ├── api/                          # API 서버 (읽기 전용)
│   │   ├── app.ts                    # Express 앱 설정
│   │   ├── server.ts                 # HTTP 서버 시작
│   │   ├── routes/
│   │   │   ├── general.routes.ts     # 장수 관련 라우트
│   │   │   ├── city.routes.ts        # 도시 관련 라우트
│   │   │   ├── battle.routes.ts      # 전투 관련 라우트
│   │   │   └── index.ts              # 라우트 통합
│   │   ├── controllers/
│   │   │   ├── general.controller.ts
│   │   │   ├── city.controller.ts
│   │   │   └── battle.controller.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts    # 인증
│   │   │   ├── error.middleware.ts   # 에러 핸들링
│   │   │   ├── cache.middleware.ts   # 캐시 미들웨어
│   │   │   └── validator.middleware.ts
│   │   └── dto/                      # Data Transfer Objects
│   │       ├── general.dto.ts
│   │       └── city.dto.ts
│   │
│   ├── daemon/                       # Game Daemon (단일 Writer)
│   │   ├── game-daemon.ts            # Daemon 메인
│   │   ├── game-loop.ts              # 100ms 게임 루프
│   │   ├── command-processor.ts      # Redis Streams 커맨드 처리
│   │   ├── state-manager.ts          # 인메모리 상태 관리
│   │   └── handlers/
│   │       ├── turn.handler.ts       # 턴 처리
│   │       ├── battle.handler.ts     # 전투 처리
│   │       └── event.handler.ts      # 이벤트 발행
│   │
│   ├── domain/                       # 도메인 로직 (DDD)
│   │   ├── general/
│   │   │   ├── general.entity.ts     # Prisma/TypeORM 엔티티
│   │   │   ├── general.repository.ts
│   │   │   ├── general.service.ts
│   │   │   └── general.aggregate.ts  # Aggregate Root
│   │   ├── city/
│   │   ├── battle/
│   │   └── nation/
│   │
│   ├── infrastructure/               # 인프라 레이어
│   │   ├── database/
│   │   │   ├── prisma/               # Prisma 사용 시
│   │   │   │   ├── schema.prisma
│   │   │   │   └── prisma-client.ts
│   │   │   └── typeorm/              # TypeORM 사용 시
│   │   │       └── ormconfig.ts
│   │   ├── cache/
│   │   │   ├── node-cache.service.ts # L1 캐시
│   │   │   ├── redis.service.ts      # L2 캐시 + Pub/Sub
│   │   │   └── cache-manager.ts      # 2-Tier 통합
│   │   ├── queue/
│   │   │   └── bull-queue.service.ts # Bull/BullMQ
│   │   └── events/
│   │       └── event-bus.service.ts  # 이벤트 버스
│   │
│   ├── shared/                       # 공유 코드
│   │   ├── constants/
│   │   ├── types/
│   │   ├── utils/
│   │   └── decorators/
│   │
│   └── config/                       # 설정
│       ├── app.config.ts
│       ├── database.config.ts
│       ├── redis.config.ts
│       └── cache.config.ts
│
├── prisma/                           # Prisma 스키마 (Prisma 사용 시)
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
├── .env
└── docker-compose.yml
```

---

## 2.3 Redis 스키마 & 캐시 전략

### Redis 키 패턴

```typescript
// 캐시 키
cache:general:{generalId}              // 장수 캐시
cache:city:{cityId}                    // 도시 캐시
cache:battle:{battleId}                // 전투 캐시
cache:nation:{nationId}:spy            // 정찰 정보

// Command Streams
cmd:game                               // 게임 커맨드 스트림

// Pub/Sub 채널
channel:cache:invalidate               // 캐시 무효화 채널
channel:game:events                    // 게임 이벤트 채널
```

### 2-Tier 캐시 구현

```typescript
// src/infrastructure/cache/cache-manager.ts
import NodeCache from 'node-cache';
import { RedisService } from './redis.service';

export class CacheManager {
  private l1Cache: NodeCache;
  private redisService: RedisService;

  constructor() {
    // L1 캐시: node-cache (3초 TTL)
    this.l1Cache = new NodeCache({
      stdTTL: 3,
      checkperiod: 1,
      useClones: false // 성능 최적화
    });

    this.redisService = new RedisService();
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 캐시 확인
    const l1Value = this.l1Cache.get<T>(key);
    if (l1Value !== undefined) {
      return l1Value;
    }

    // L2 캐시 확인 (Redis)
    const l2Value = await this.redisService.get<T>(key);
    if (l2Value) {
      // L1 캐시에 저장
      this.l1Cache.set(key, l2Value);
      return l2Value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // L1 캐시에 저장
    this.l1Cache.set(key, value, ttl || 3);
    
    // L2 캐시에 저장 (Redis)
    await this.redisService.set(key, value, ttl);
  }

  async invalidate(key: string): Promise<void> {
    // L1 캐시 삭제
    this.l1Cache.del(key);
    
    // L2 캐시 삭제
    await this.redisService.del(key);
    
    // 다른 API 서버에 무효화 알림
    await this.redisService.publish('channel:cache:invalidate', key);
  }
}
```

---

## 2.4 DDD 패턴 적용 (Express.js)

### Aggregate Root 예제

```typescript
// src/domain/general/general.aggregate.ts
import { Stats, Equipment, Military } from './value-objects';
import { DomainEvent } from '../../shared/domain/domain-event';

export class General {
  private domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public name: string,
    public stats: Stats,
    public equipment: Equipment,
    public military: Military,
    // ... 기타 속성
  ) {}

  // 도메인 메서드
  train(statType: 'leadership' | 'strength' | 'intel', amount: number): void {
    if (this.military.training < 100) {
      throw new Error('훈련도가 100 미만입니다');
    }

    this.stats.increase(statType, amount);
    this.military.training -= 100;

    // 도메인 이벤트 발행
    this.addDomainEvent({
      type: 'GeneralTrained',
      aggregateId: this.id,
      data: { statType, amount }
    });
  }

  equipItem(item: Item): void {
    if (this.equipment.isFull()) {
      throw new Error('장비 슬롯이 가득 찼습니다');
    }

    this.equipment.equip(item);
    this.addDomainEvent({
      type: 'ItemEquipped',
      aggregateId: this.id,
      data: { itemId: item.id }
    });
  }

  private addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
```

### Value Object 예제

```typescript
// src/domain/general/value-objects/stats.ts
export class Stats {
  constructor(
    public leadership: number,
    public strength: number,
    public intel: number,
    public politics: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.leadership < 0 || this.leadership > 150) {
      throw new Error('통솔력은 0-150 사이여야 합니다');
    }
    // ... 나머지 검증
  }

  increase(type: keyof Stats, amount: number): void {
    const newValue = this[type] + amount;
    if (newValue > 150) {
      this[type] = 150;
    } else {
      this[type] = newValue;
    }
  }

  // Value Object는 불변성을 위해 새 인스턴스 반환
  withIncreasedLeadership(amount: number): Stats {
    return new Stats(
      Math.min(this.leadership + amount, 150),
      this.strength,
      this.intel,
      this.politics
    );
  }
}
```

### Repository 패턴 (Prisma)

```typescript
// src/domain/general/general.repository.ts
import { PrismaClient } from '@prisma/client';
import { General } from './general.aggregate';
import { injectable } from 'tsyringe';

@injectable()
export class GeneralRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<General | null> {
    const data = await this.prisma.general.findUnique({
      where: { id },
      include: {
        items: true,
        specialAbilities: true
      }
    });

    if (!data) return null;

    return this.toDomain(data);
  }

  async save(general: General): Promise<void> {
    const data = this.toPersistence(general);
    
    await this.prisma.general.upsert({
      where: { id: general.id },
      update: data,
      create: data
    });

    // 도메인 이벤트 발행
    const events = general.getDomainEvents();
    for (const event of events) {
      await this.publishEvent(event);
    }
    general.clearDomainEvents();
  }

  private toDomain(data: any): General {
    // DB 데이터 → 도메인 객체 변환
    return new General(
      data.id,
      data.name,
      new Stats(data.leadership, data.strength, data.intel, data.politics),
      // ... 변환 로직
    );
  }

  private toPersistence(general: General): any {
    // 도메인 객체 → DB 데이터 변환
    return {
      id: general.id,
      name: general.name,
      leadership: general.stats.leadership,
      // ... 변환 로직
    };
  }

  private async publishEvent(event: DomainEvent): Promise<void> {
    // 이벤트 버스에 발행
  }
}
```

---

# PART 3: 구현 가이드

## 3.1 API 서버 구현 (Express.js)

### app.ts - Express 앱 설정

```typescript
// src/api/app.ts
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { json, urlencoded } from 'body-parser';
import { routes } from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { requestLoggerMiddleware } from './middleware/logger.middleware';

export function createApp(): Application {
  const app = express();

  // 보안 미들웨어
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));

  // 압축
  app.use(compression());

  // Body parser
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // 로깅
  app.use(requestLoggerMiddleware);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api', routes);

  // 404 핸들러
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // 에러 핸들러 (마지막에 위치)
  app.use(errorMiddleware);

  return app;
}
```

### server.ts - HTTP 서버 시작

```typescript
// src/api/server.ts
import 'reflect-metadata'; // tsyringe 사용 시 필요
import { container } from 'tsyringe';
import { createApp } from './app';
import { CacheManager } from '../infrastructure/cache/cache-manager';
import { RedisService } from '../infrastructure/cache/redis.service';

async function bootstrap() {
  // DI 컨테이너 설정
  container.register('CacheManager', { useClass: CacheManager });
  container.register('RedisService', { useClass: RedisService });

  // Express 앱 생성
  const app = createApp();
  const port = process.env.API_PORT || 3000;

  // HTTP 서버 시작
  const server = app.listen(port, () => {
    console.log(`🚀 API Server running on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

bootstrap().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

### Routes 예제

```typescript
// src/api/routes/general.routes.ts
import { Router } from 'express';
import { container } from 'tsyringe';
import { GeneralController } from '../controllers/general.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { cacheMiddleware } from '../middleware/cache.middleware';
import { validateMiddleware } from '../middleware/validator.middleware';
import { GeneralQueryDto, GeneralActionDto } from '../dto/general.dto';

const router = Router();
const controller = container.resolve(GeneralController);

// 조회 API (캐시 적용)
router.get(
  '/:id',
  authMiddleware,
  cacheMiddleware({ ttl: 3 }),
  controller.getGeneral.bind(controller)
);

router.get(
  '/',
  authMiddleware,
  validateMiddleware(GeneralQueryDto),
  controller.listGenerals.bind(controller)
);

// 액션 API (커맨드 발행)
router.post(
  '/:id/train',
  authMiddleware,
  validateMiddleware(GeneralActionDto),
  controller.trainGeneral.bind(controller)
);

router.post(
  '/:id/equip',
  authMiddleware,
  validateMiddleware(GeneralActionDto),
  controller.equipItem.bind(controller)
);

export { router as generalRoutes };
```

### Controller 예제

```typescript
// src/api/controllers/general.controller.ts
import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { GeneralService } from '../../domain/general/general.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { CacheManager } from '../../infrastructure/cache/cache-manager';

@injectable()
export class GeneralController {
  constructor(
    private generalService: GeneralService,
    private cacheManager: CacheManager,
    private redisService: RedisService
  ) {}

  async getGeneral(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // 캐시 확인
      const cacheKey = `cache:general:${id}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }

      // DB 조회
      const general = await this.generalService.findById(id);
      
      if (!general) {
        return res.status(404).json({ error: 'General not found' });
      }

      // 캐시 저장
      await this.cacheManager.set(cacheKey, general, 60);

      res.json(general);
    } catch (error) {
      next(error);
    }
  }

  async trainGeneral(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { statType, amount } = req.body;

      // Redis Streams에 커맨드 발행
      const command = {
        type: 'TRAIN_GENERAL',
        generalId: id,
        data: { statType, amount },
        userId: req.user.id,
        timestamp: Date.now()
      };

      await this.redisService.xadd('cmd:game', '*', {
        payload: JSON.stringify(command)
      });

      // 즉시 응답 (비동기 처리)
      res.status(202).json({
        message: 'Command queued',
        commandId: command.timestamp
      });
    } catch (error) {
      next(error);
    }
  }

  async listGenerals(req: Request, res: Response, next: NextFunction) {
    try {
      const { nationId, page = 1, limit = 20 } = req.query;

      const generals = await this.generalService.findByNation(
        nationId as string,
        Number(page),
        Number(limit)
      );

      res.json(generals);
    } catch (error) {
      next(error);
    }
  }
}
```

---

## 3.2 Game Daemon 구현

### game-daemon.ts - Daemon 메인

```typescript
// src/daemon/game-daemon.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { GameLoop } from './game-loop';
import { CommandProcessor } from './command-processor';
import { StateManager } from './state-manager';

class GameDaemon {
  private gameLoop: GameLoop;
  private commandProcessor: CommandProcessor;
  private stateManager: StateManager;

  constructor() {
    // DI 컨테이너 설정
    this.stateManager = container.resolve(StateManager);
    this.commandProcessor = container.resolve(CommandProcessor);
    this.gameLoop = container.resolve(GameLoop);
  }

  async start() {
    console.log('🎮 Starting Game Daemon...');

    // 상태 초기화
    await this.stateManager.initialize();

    // 커맨드 프로세서 시작
    this.commandProcessor.start();

    // 게임 루프 시작
    this.gameLoop.start();

    console.log('✅ Game Daemon started successfully');
  }

  async stop() {
    console.log('Stopping Game Daemon...');
    
    this.gameLoop.stop();
    this.commandProcessor.stop();
    
    await this.stateManager.cleanup();
    
    console.log('Game Daemon stopped');
  }
}

// 메인 실행
async function main() {
  const daemon = new GameDaemon();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await daemon.stop();
    process.exit(0);
  });

  await daemon.start();
}

main().catch(error => {
  console.error('Failed to start Game Daemon:', error);
  process.exit(1);
});
```

### game-loop.ts - 100ms 게임 루프

```typescript
// src/daemon/game-loop.ts
import { injectable } from 'tsyringe';
import { StateManager } from './state-manager';
import { TurnHandler } from './handlers/turn.handler';
import { BattleHandler } from './handlers/battle.handler';

@injectable()
export class GameLoop {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private tickCount = 0;

  constructor(
    private stateManager: StateManager,
    private turnHandler: TurnHandler,
    private battleHandler: BattleHandler
  ) {}

  start() {
    if (this.isRunning) {
      console.warn('Game loop is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting game loop (100ms tick)...');

    this.intervalId = setInterval(() => {
      this.tick();
    }, 100); // 100ms
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('Game loop stopped');
  }

  private async tick() {
    try {
      this.tickCount++;

      // 1초마다 실행 (10 ticks)
      if (this.tickCount % 10 === 0) {
        await this.onSecond();
      }

      // 10초마다 실행 (100 ticks)
      if (this.tickCount % 100 === 0) {
        await this.onTenSeconds();
      }

      // 1분마다 실행 (600 ticks)
      if (this.tickCount % 600 === 0) {
        await this.onMinute();
      }

    } catch (error) {
      console.error('Error in game loop tick:', error);
    }
  }

  private async onSecond() {
    // 실시간 전투 처리
    await this.battleHandler.processActiveBattles();
  }

  private async onTenSeconds() {
    // 턴 자동 실행 체크
    await this.turnHandler.checkAutoTurns();
  }

  private async onMinute() {
    // 장기 상태 갱신
    await this.stateManager.refreshHotData();
  }
}
```

### command-processor.ts - Redis Streams 커맨드 처리

```typescript
// src/daemon/command-processor.ts
import { injectable } from 'tsyringe';
import { RedisService } from '../infrastructure/cache/redis.service';
import { TurnHandler } from './handlers/turn.handler';
import { BattleHandler } from './handlers/battle.handler';

@injectable()
export class CommandProcessor {
  private isRunning = false;
  private consumerGroup = 'game-daemon';
  private consumerName = `daemon-${process.pid}`;

  constructor(
    private redisService: RedisService,
    private turnHandler: TurnHandler,
    private battleHandler: BattleHandler
  ) {}

  async start() {
    this.isRunning = true;
    console.log('Starting command processor...');

    // Consumer Group 생성 (존재하지 않으면)
    try {
      await this.redisService.xgroupCreate(
        'cmd:game',
        this.consumerGroup,
        '0',
        { MKSTREAM: true }
      );
    } catch (error) {
      // Group already exists
    }

    // 커맨드 폴링 시작
    this.pollCommands();
  }

  stop() {
    this.isRunning = false;
    console.log('Command processor stopped');
  }

  private async pollCommands() {
    while (this.isRunning) {
      try {
        const messages = await this.redisService.xreadgroup(
          this.consumerGroup,
          this.consumerName,
          { 'cmd:game': '>' },
          { COUNT: 10, BLOCK: 1000 } // 1초 블로킹
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [id, data] of streamMessages) {
              await this.processCommand(id, data);
            }
          }
        }
      } catch (error) {
        console.error('Error polling commands:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processCommand(id: string, data: any) {
    try {
      const command = JSON.parse(data.payload);

      switch (command.type) {
        case 'TRAIN_GENERAL':
          await this.turnHandler.handleTrainGeneral(command);
          break;
        
        case 'EQUIP_ITEM':
          await this.turnHandler.handleEquipItem(command);
          break;

        case 'START_BATTLE':
          await this.battleHandler.handleStartBattle(command);
          break;

        case 'BATTLE_ACTION':
          await this.battleHandler.handleBattleAction(command);
          break;

        default:
          console.warn(`Unknown command type: ${command.type}`);
      }

      // ACK 처리
      await this.redisService.xack('cmd:game', this.consumerGroup, id);

    } catch (error) {
      console.error(`Error processing command ${id}:`, error);
      // DLQ로 이동하거나 재시도 로직 추가
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### state-manager.ts - 인메모리 상태 관리

```typescript
// src/daemon/state-manager.ts
import { injectable } from 'tsyringe';
import { GeneralRepository } from '../domain/general/general.repository';
import { CityRepository } from '../domain/city/city.repository';
import { General } from '../domain/general/general.aggregate';
import { City } from '../domain/city/city.aggregate';

@injectable()
export class StateManager {
  // 핫 데이터 인메모리 캐시
  private generals = new Map<string, General>();
  private cities = new Map<string, City>();
  private activeBattles = new Map<string, any>();

  constructor(
    private generalRepository: GeneralRepository,
    private cityRepository: CityRepository
  ) {}

  async initialize() {
    console.log('Initializing state manager...');

    // 활성 장수들을 메모리에 로드
    const activeGenerals = await this.generalRepository.findActive();
    for (const general of activeGenerals) {
      this.generals.set(general.id, general);
    }

    // 활성 도시들을 메모리에 로드
    const activeCities = await this.cityRepository.findAll();
    for (const city of activeCities) {
      this.cities.set(city.id, city);
    }

    console.log(`Loaded ${this.generals.size} generals, ${this.cities.size} cities`);
  }

  async refreshHotData() {
    // 주기적으로 핫 데이터 갱신
    const dirtyGenerals = Array.from(this.generals.values())
      .filter(g => g.isDirty());

    for (const general of dirtyGenerals) {
      await this.generalRepository.save(general);
      general.markClean();
    }
  }

  async cleanup() {
    // 모든 변경사항 저장
    await this.refreshHotData();
    
    this.generals.clear();
    this.cities.clear();
    this.activeBattles.clear();
  }

  // Getter methods
  getGeneral(id: string): General | undefined {
    return this.generals.get(id);
  }

  getCity(id: string): City | undefined {
    return this.cities.get(id);
  }

  // Setter methods
  setGeneral(general: General): void {
    this.generals.set(general.id, general);
  }

  setCity(city: City): void {
    this.cities.set(city.id, city);
  }
}
```

---

## 3.3 캐시 미들웨어

```typescript
// src/api/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CacheManager } from '../../infrastructure/cache/cache-manager';

interface CacheOptions {
  ttl?: number; // seconds
  keyGenerator?: (req: Request) => string;
}

export function cacheMiddleware(options: CacheOptions = {}) {
  const cacheManager = container.resolve(CacheManager);

  return async (req: Request, res: Response, next: NextFunction) => {
    // GET 요청만 캐싱
    if (req.method !== 'GET') {
      return next();
    }

    // 캐시 키 생성
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : `cache:${req.originalUrl}`;

    try {
      // 캐시 확인
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      // 캐시 미스: 원본 응답을 캐싱
      res.set('X-Cache', 'MISS');

      // 원본 json 메서드를 래핑
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        // 비동기로 캐시 저장
        cacheManager.set(cacheKey, data, options.ttl || 3)
          .catch(err => console.error('Cache set error:', err));
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      // 캐시 에러는 무시하고 진행
      console.error('Cache middleware error:', error);
      next();
    }
  };
}
```

---

## 3.4 에러 핸들링

```typescript
// src/api/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // AppError인 경우
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // 일반 에러
  console.error('Unhandled error:', err);

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
}
```

---

# PART 4: Prisma 스키마 (엔티티 정의)

## 4.1 Prisma Schema 예제

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========================================
// 1. General (장수)
// ========================================

model General {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 기본 정보
  name      String
  npcType   Int      @default(0)
  npcCount  Int      @default(0)

  // 소속
  nationId  String?
  nation    Nation?  @relation(fields: [nationId], references: [id])
  cityId    String?
  city      City?    @relation(fields: [cityId], references: [id])

  // 능력치
  leadership Int @default(50)
  strength   Int @default(50)
  intel      Int @default(50)
  politics   Int @default(50)

  // 자원
  gold       Int @default(0)
  rice       Int @default(0)
  
  // 병력
  crewType   String?
  crew       Int @default(0)
  crewTrain  Int @default(0)
  crewAtmos  Int @default(0)

  // 턴 정보
  turnTime   Int @default(0)
  dedline    DateTime?

  // 관계
  items            GeneralItem[]
  specialAbilities GeneralSpecialAbility[]
  turns            GeneralTurn[]

  @@index([nationId])
  @@index([cityId])
  @@map("general")
}

// ========================================
// 2. Nation (국가)
// ========================================

model Nation {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 기본 정보
  name      String
  color     String
  level     Int      @default(1)

  // 국가 특성
  typeId    String?
  type      NationType? @relation(fields: [typeId], references: [id])

  // 군주
  chieId    String?
  
  // 관계
  generals  General[]
  cities    City[]
  turns     NationTurn[]

  @@map("nation")
}

// ========================================
// 3. City (도시)
// ========================================

model City {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 기본 정보
  name      String
  x         Int
  y         Int

  // 소속
  nationId  String?
  nation    Nation?  @relation(fields: [nationId], references: [id])

  // 시설
  agri      Int @default(1000)
  comm      Int @default(1000)
  secu      Int @default(1000)
  wall      Int @default(100)

  // 자원
  gold      Int @default(10000)
  rice      Int @default(10000)

  // 병력
  crewType  String?
  crew      Int @default(10000)
  crewTrain Int @default(0)

  // 관계
  generals  General[]

  @@index([nationId])
  @@index([x, y])
  @@map("city")
}

// ========================================
// 4. Item System
// ========================================

model ItemType {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 기본 정보
  code        String   @unique
  name        String
  description String?
  rarity      Int      @default(1)

  // 효과
  effects     Json     // Array of { type, value, condition }

  // 관계
  items       GeneralItem[]

  @@map("item_type")
}

model GeneralItem {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  generalId String
  general   General  @relation(fields: [generalId], references: [id], onDelete: Cascade)

  typeId    String
  type      ItemType @relation(fields: [typeId], references: [id])

  // 아이템 레벨/등급
  level     Int      @default(1)
  equipped  Boolean  @default(false)

  @@index([generalId])
  @@index([typeId])
  @@map("general_item")
}

// ========================================
// 5. Special Ability System
// ========================================

model SpecialAbilityType {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 기본 정보
  code        String   @unique
  name        String
  description String?
  triggerType String   // "PASSIVE", "ACTIVE", "COMBAT"

  // 효과
  effects     Json     // Array of { type, value, condition }

  // 관계
  abilities   GeneralSpecialAbility[]

  @@map("special_ability_type")
}

model GeneralSpecialAbility {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  generalId String
  general   General  @relation(fields: [generalId], references: [id], onDelete: Cascade)

  typeId    String
  type      SpecialAbilityType @relation(fields: [typeId], references: [id])

  level     Int      @default(1)

  @@index([generalId])
  @@index([typeId])
  @@map("general_special_ability")
}

// ========================================
// 6. Crew Type (병종)
// ========================================

model CrewType {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  code        String   @unique
  name        String
  tier        Int      @default(1)

  // 기본 능력치
  attack      Int      @default(100)
  defense     Int      @default(100)
  accuracy    Int      @default(100)
  mobility    Int      @default(100)

  // 병종 상성
  affinities  CrewTypeAffinityRule[]

  @@map("crew_type")
}

model CrewTypeAffinityRule {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  fromTypeId String
  fromType   CrewType @relation(fields: [fromTypeId], references: [id])

  toTypeCode String
  modifier   Float    @default(1.0) // 1.3 = 130% damage

  @@unique([fromTypeId, toTypeCode])
  @@map("crew_type_affinity_rule")
}

// ========================================
// 7. Nation Type (국가 특성)
// ========================================

model NationType {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  code        String   @unique
  name        String
  description String?

  // 보너스
  bonuses     Json     // Array of { type, value }

  // 관계
  nations     Nation[]

  @@map("nation_type")
}

// ========================================
// 8. Turn System
// ========================================

model GeneralTurn {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  generalId String
  general   General  @relation(fields: [generalId], references: [id], onDelete: Cascade)

  turnType  String   // "train", "move", "attack", etc.
  arg       Json     // 액션별 파라미터

  year      Int
  month     Int

  @@index([generalId])
  @@index([year, month])
  @@map("general_turn")
}

model NationTurn {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  nationId  String
  nation    Nation   @relation(fields: [nationId], references: [id], onDelete: Cascade)

  turnType  String   // "diplomacy", "policy", etc.
  arg       Json

  year      Int
  month     Int

  @@index([nationId])
  @@index([year, month])
  @@map("nation_turn")
}

// ========================================
// 9. Battle System
// ========================================

model Battle {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  attackNationId String
  defenceNationId String

  cityId    String

  phase     Int      @default(0)
  turn      Int      @default(0)
  result    String?  // "ATTACKER_WIN", "DEFENDER_WIN", "ONGOING"

  units     BattleUnit[]
  turns     BattleTurn[]

  @@map("battle")
}

model BattleUnit {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  battleId  String
  battle    Battle   @relation(fields: [battleId], references: [id], onDelete: Cascade)

  generalId String
  
  side      String   // "ATTACKER", "DEFENDER"
  crewType  String
  crew      Int
  killed    Int      @default(0)

  x         Int
  y         Int

  skills    Json     // Array of skill snapshots

  @@index([battleId])
  @@map("battle_unit")
}

model BattleTurn {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  battleId  String
  battle    Battle   @relation(fields: [battleId], references: [id], onDelete: Cascade)

  phase     Int
  turn      Int

  log       Json     // 전투 로그 데이터

  @@index([battleId])
  @@map("battle_turn")
}
```

---

## 4.2 Prisma Client 사용 예제

```typescript
// src/infrastructure/database/prisma/prisma-client.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

export { prisma };
```

```typescript
// src/domain/general/general.repository.ts
import { prisma } from '../../infrastructure/database/prisma/prisma-client';
import { General } from './general.aggregate';

export class GeneralRepository {
  async findById(id: string): Promise<General | null> {
    const data = await prisma.general.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            type: true
          }
        },
        specialAbilities: {
          include: {
            type: true
          }
        },
        nation: true,
        city: true
      }
    });

    if (!data) return null;

    return this.toDomain(data);
  }

  async findByNation(
    nationId: string,
    page: number,
    limit: number
  ): Promise<General[]> {
    const data = await prisma.general.findMany({
      where: { nationId },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        specialAbilities: true
      }
    });

    return data.map(d => this.toDomain(d));
  }

  async save(general: General): Promise<void> {
    const data = this.toPersistence(general);

    await prisma.general.upsert({
      where: { id: general.id },
      update: data,
      create: data
    });
  }

  private toDomain(data: any): General {
    // Prisma 데이터 → 도메인 모델 변환
    return new General(
      data.id,
      data.name,
      {
        leadership: data.leadership,
        strength: data.strength,
        intel: data.intel,
        politics: data.politics
      },
      // ... 나머지 변환
    );
  }

  private toPersistence(general: General): any {
    // 도메인 모델 → Prisma 데이터 변환
    return {
      id: general.id,
      name: general.name,
      leadership: general.stats.leadership,
      strength: general.stats.strength,
      intel: general.stats.intel,
      politics: general.stats.politics,
      // ... 나머지 변환
    };
  }
}
```

---

## 4.3 DTO 및 Validation

```typescript
// src/api/dto/general.dto.ts
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  IsEnum
} from 'class-validator';

export class GeneralQueryDto {
  @IsOptional()
  @IsString()
  nationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GeneralActionDto {
  @IsEnum(['leadership', 'strength', 'intel', 'politics'])
  statType!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  amount!: number;
}

export class GeneralEquipDto {
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  slot?: number;
}
```

```typescript
// src/api/middleware/validator.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

export function validateMiddleware<T extends object>(
  dtoClass: new () => T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(dtoClass, req[source]);

    const errors: ValidationError[] = await validate(dto);

    if (errors.length > 0) {
      const messages = errors.map(error => ({
        property: error.property,
        constraints: error.constraints
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: messages
      });
    }

    // DTO를 request에 주입
    req[source] = dto;
    next();
  };
}
```

---

# PART 5: 배포 및 운영

## 5.1 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: sangokushi
      POSTGRES_PASSWORD: password
      POSTGRES_DB: sangokushi_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sangokushi"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Server (복수 인스턴스)
  api-server:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://sangokushi:password@postgres:5432/sangokushi_db
      REDIS_URL: redis://redis:6379
      API_PORT: 3000
    ports:
      - "3000-3002:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 3
    restart: unless-stopped

  # Game Daemon (단일 인스턴스)
  game-daemon:
    build:
      context: .
      dockerfile: Dockerfile.daemon
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://sangokushi:password@postgres:5432/sangokushi_db
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  # Nginx (Load Balancer)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api-server
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## 5.2 Dockerfile

```dockerfile
# Dockerfile.api
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
```

```dockerfile
# Dockerfile.daemon
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

CMD ["node", "dist/daemon/game-daemon.js"]
```

---

## 5.3 PM2 설정 (로컬 개발/단일 서버)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // API Server (4개 인스턴스)
    {
      name: 'api-server',
      script: 'dist/api/server.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3000
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
      time: true
    },
    // Game Daemon (단일 인스턴스)
    {
      name: 'game-daemon',
      script: 'dist/daemon/game-daemon.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/daemon-error.log',
      out_file: 'logs/daemon-out.log',
      time: true,
      restart_delay: 5000
    }
  ]
};
```

실행:
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 5.4 환경 변수 (.env)

```env
# Application
NODE_ENV=production
API_PORT=3000

# Database
DATABASE_URL=postgresql://sangokushi:password@localhost:5432/sangokushi_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_STREAMS_GROUP=game-daemon

# Cache
L1_CACHE_TTL=3
L2_CACHE_TTL=60

# CORS
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# JWT (선택)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Game Settings
GAME_LOOP_INTERVAL=100
TURN_DURATION_HOURS=24
```

---

# PART 6: 마이그레이션 체크리스트

## 6.1 개발 단계

- [ ] Node.js 20+ 설치
- [ ] TypeScript 프로젝트 설정
- [ ] Prisma 설정 및 스키마 작성
- [ ] Express 앱 기본 구조 생성
- [ ] DI 컨테이너 설정 (tsyringe)
- [ ] 2-Tier 캐시 구현
- [ ] Redis Streams 커맨드 시스템 구현
- [ ] Game Daemon 기본 구조 구현
- [ ] 도메인 모델 구현 (DDD)
- [ ] Repository 패턴 구현
- [ ] API 엔드포인트 구현
- [ ] 유닛 테스트 작성
- [ ] 통합 테스트 작성

## 6.2 배포 단계

- [ ] Docker 이미지 빌드
- [ ] Docker Compose 설정
- [ ] Nginx 설정
- [ ] PM2 설정 (단일 서버)
- [ ] 환경 변수 설정
- [ ] 데이터베이스 마이그레이션
- [ ] 모니터링 설정 (Prometheus + Grafana)
- [ ] 로깅 설정
- [ ] 백업 전략 수립

## 6.3 운영 단계

- [ ] Health check 엔드포인트 확인
- [ ] 캐시 성능 모니터링
- [ ] Game Daemon 안정성 확인
- [ ] 동시 접속자 부하 테스트
- [ ] 롤백 계획 수립
- [ ] 장애 대응 매뉴얼 작성

---

# PART 7: 다음 단계

## 7.1 성능 최적화

1. **쿼리 최적화**
   - Prisma 쿼리 분석
   - N+1 문제 해결
   - 인덱스 추가

2. **캐시 전략 고도화**
   - Cache-Aside 패턴
   - Write-Through 패턴
   - 캐시 워밍

3. **비동기 처리**
   - Bull Queue 활용
   - 백그라운드 작업 분리

## 7.2 기능 확장

1. **실시간 통신**
   - Socket.io 통합
   - WebSocket 전투 시스템

2. **관리자 도구**
   - Admin Dashboard
   - 데이터 편집 도구

3. **모니터링**
   - APM 도구 통합
   - 커스텀 메트릭

---

# 부록 A: Spring Boot vs Express.js 코드 비교

## Controller 비교

**Spring Boot:**
```java
@RestController
@RequestMapping("/api/generals")
public class GeneralController {
    @Autowired
    private GeneralService service;
    
    @GetMapping("/{id}")
    public ResponseEntity<GeneralDto> get(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }
}
```

**Express.js:**
```typescript
@injectable()
export class GeneralController {
    constructor(private service: GeneralService) {}
    
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const general = await this.service.findById(req.params.id);
            res.json(general);
        } catch (error) {
            next(error);
        }
    }
}
```

## Repository 비교

**Spring Boot (JPA):**
```java
public interface GeneralRepository extends JpaRepository<General, String> {
    List<General> findByNationId(String nationId);
}
```

**Express.js (Prisma):**
```typescript
export class GeneralRepository {
    async findByNationId(nationId: string): Promise<General[]> {
        const data = await prisma.general.findMany({
            where: { nationId }
        });
        return data.map(d => this.toDomain(d));
    }
}
```

---

# 부록 B: FAQ

**Q: TypeScript를 꼭 써야 하나요?**  
A: 권장합니다. 타입 안정성과 DDD 패턴 구현에 큰 도움이 됩니다.

**Q: Prisma vs TypeORM 어떤 것을 선택해야 하나요?**  
A: Prisma를 권장합니다. 타입 안정성이 우수하고 마이그레이션이 편리합니다.

**Q: Game Daemon을 여러 개 실행할 수 있나요?**  
A: 단일 Writer 패턴이므로 1개만 실행해야 합니다. 고가용성을 위해 standby 인스턴스를 두고 failover를 구현할 수 있습니다.

**Q: PM2 cluster 모드를 API 서버에 사용해도 되나요?**  
A: 네, API 서버는 stateless이므로 cluster 모드로 여러 인스턴스를 실행하는 것이 좋습니다.

**Q: Redis Pub/Sub과 Streams의 차이는?**  
A: Pub/Sub은 실시간 알림(캐시 무효화)에, Streams는 커맨드 큐(at-least-once 보장)에 사용합니다.

---

**문서 끝**

Express.js 버전으로 변환한 삼국지 게임 아키텍처 문서입니다. Spring Boot의 주요 개념을 Node.js 생태계에 맞게 변환했으며, TypeScript + Prisma + tsyringe를 활용한 현대적인 구조로 설계했습니다.
