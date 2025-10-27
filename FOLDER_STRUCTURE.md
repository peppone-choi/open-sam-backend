# 폴더 구조 가이드 - 도메인 중심 설계

## 📁 추천 구조 (도메인별 repository/router/service 묶기)

```
src/
├── server.ts                  # API 서버 엔트리포인트
├── daemon.ts                  # Game Daemon 엔트리포인트
│
├── general/                   # 장수 도메인
│   ├── repository/
│   │   └── general.repository.ts
│   ├── router/
│   │   └── general.router.ts
│   ├── service/
│   │   └── general.service.ts
│   ├── general.schema.ts      # Mongoose 스키마
│   └── general.types.ts       # TypeScript 타입
│
├── city/                      # 도시 도메인
│   ├── repository/
│   │   └── city.repository.ts
│   ├── router/
│   │   └── city.router.ts
│   ├── service/
│   │   └── city.service.ts
│   ├── city.schema.ts
│   └── city.types.ts
│
├── nation/                    # 국가 도메인
│   ├── repository/
│   │   └── nation.repository.ts
│   ├── router/
│   │   └── nation.router.ts
│   ├── service/
│   │   └── nation.service.ts
│   ├── nation.schema.ts
│   └── nation.types.ts
│
├── command/                   # 명령 도메인
│   ├── repository/
│   │   └── command.repository.ts
│   ├── router/
│   │   └── command.router.ts
│   ├── service/
│   │   └── command.service.ts
│   ├── command.schema.ts
│   └── command.types.ts
│
├── battle/                    # 전투 도메인
│   ├── repository/
│   │   └── battle.repository.ts
│   ├── router/
│   │   └── battle.router.ts
│   ├── service/
│   │   └── battle.service.ts
│   ├── handlers/              # 전투 핸들러
│   │   └── battle.handler.ts
│   ├── battle.schema.ts
│   └── battle.types.ts
│
├── item/                      # 아이템 도메인
│   ├── repository/
│   │   └── item.repository.ts
│   ├── router/
│   │   └── item.router.ts
│   ├── service/
│   │   └── item.service.ts
│   ├── item.schema.ts
│   └── item.types.ts
│
├── infrastructure/            # 인프라 레이어
│   ├── cache/
│   │   ├── redis.service.ts
│   │   ├── l1-cache.service.ts
│   │   └── cache-manager.ts
│   ├── db/
│   │   └── connection.ts
│   └── queue/
│       └── command-queue.ts
│
├── daemon/                    # 데몬 레이어
│   ├── game-loop.ts           # 게임 루프 (1초 tick)
│   ├── command-processor.ts   # Redis Streams 소비
│   └── persist-scheduler.ts   # 영속화 스케줄러 (5분)
│
├── common/                    # 공통 레이어
│   ├── middleware/
│   │   ├── cache.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── auth.middleware.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── time.util.ts
│   └── constants/
│       └── game-config.ts
│
└── config/                    # 설정
    ├── app.config.ts
    └── env.ts
```

---

## 🛠️ 폴더 생성 명령어

### 한 번에 생성
```bash
# 도메인 폴더들
mkdir -p src/general/{repository,router,service}
mkdir -p src/city/{repository,router,service}
mkdir -p src/nation/{repository,router,service}
mkdir -p src/command/{repository,router,service}
mkdir -p src/battle/{repository,router,service,handlers}
mkdir -p src/item/{repository,router,service}

# 인프라
mkdir -p src/infrastructure/{cache,db,queue}

# 데몬
mkdir -p src/daemon

# 공통
mkdir -p src/common/{middleware,types,utils,constants}

# 설정
mkdir -p src/config
```

### 또는 하나씩 생성
```bash
# General 도메인
mkdir -p src/general/repository
mkdir -p src/general/router
mkdir -p src/general/service

# City 도메인
mkdir -p src/city/repository
mkdir -p src/city/router
mkdir -p src/city/service

# Nation 도메인
mkdir -p src/nation/repository
mkdir -p src/nation/router
mkdir -p src/nation/service

# Command 도메인
mkdir -p src/command/repository
mkdir -p src/command/router
mkdir -p src/command/service

# Battle 도메인
mkdir -p src/battle/repository
mkdir -p src/battle/router
mkdir -p src/battle/service
mkdir -p src/battle/handlers

# Item 도메인
mkdir -p src/item/repository
mkdir -p src/item/router
mkdir -p src/item/service

# Infrastructure
mkdir -p src/infrastructure/cache
mkdir -p src/infrastructure/db
mkdir -p src/infrastructure/queue

# Daemon
mkdir -p src/daemon

# Common
mkdir -p src/common/middleware
mkdir -p src/common/types
mkdir -p src/common/utils
mkdir -p src/common/constants

# Config
mkdir -p src/config
```

---

## 📋 각 도메인의 파일 목록

### General (장수) 도메인 예시
```
src/general/
├── repository/
│   └── general.repository.ts    # DB CRUD
├── router/
│   └── general.router.ts        # Express 라우터
├── service/
│   └── general.service.ts       # 비즈니스 로직
├── general.schema.ts            # Mongoose 스키마
└── general.types.ts             # TypeScript 인터페이스
```

### 각 파일 역할
- **schema**: Mongoose 스키마 정의
- **types**: TypeScript 인터페이스/타입 정의
- **repository**: DB CRUD 작업
- **service**: 비즈니스 로직, 검증, 변환
- **router**: HTTP 엔드포인트 정의

---

## 🎯 파일 생성 순서 (추천)

### Phase 1: Infrastructure (인프라)
```
1. src/common/utils/logger.ts
2. src/infrastructure/cache/redis.service.ts
3. src/infrastructure/cache/l1-cache.service.ts
4. src/infrastructure/cache/cache-manager.ts
5. src/infrastructure/db/connection.ts
```

### Phase 2: General 도메인 (예시)
```
6. src/general/general.types.ts
7. src/general/general.schema.ts
8. src/general/repository/general.repository.ts
9. src/general/service/general.service.ts
10. src/general/router/general.router.ts
```

### Phase 3: Command 도메인
```
11. src/command/command.types.ts
12. src/command/command.schema.ts
13. src/command/repository/command.repository.ts
14. src/command/service/command.service.ts
15. src/command/router/command.router.ts
```

### Phase 4: 나머지 도메인
```
16-20. src/city/* (5개 파일)
21-25. src/nation/* (5개 파일)
26-30. src/battle/* (5개 파일 + handlers)
31-35. src/item/* (5개 파일)
```

### Phase 5: Daemon
```
36. src/daemon/game-loop.ts
37. src/daemon/command-processor.ts
38. src/daemon/persist-scheduler.ts
```

### Phase 6: Common & Config
```
39. src/common/middleware/cache.middleware.ts
40. src/common/middleware/error.middleware.ts
41. src/config/app.config.ts
```

### Phase 7: Server 통합
```
42. src/server.ts (업데이트)
43. src/daemon.ts (업데이트)
```

---

## 🔗 라우터 통합 예시

**src/server.ts**
```typescript
import express from 'express';
import generalRouter from './general/router/general.router';
import cityRouter from './city/router/city.router';
import commandRouter from './command/router/command.router';
import battleRouter from './battle/router/battle.router';

const app = express();

app.use('/api/generals', generalRouter);
app.use('/api/cities', cityRouter);
app.use('/api/commands', commandRouter);
app.use('/api/battles', battleRouter);

app.listen(3000);
```

---

## 📝 도메인별 파일 템플릿

### Schema 템플릿
```typescript
// src/{domain}/{domain}.schema.ts
import { Schema, model, Document } from 'mongoose';

export interface I{Domain} extends Document {
  name: string;
  // 필드들...
  createdAt: Date;
  updatedAt: Date;
}

const {Domain}Schema = new Schema<I{Domain}>({
  name: { type: String, required: true },
  // 필드들...
}, { timestamps: true });

export const {Domain}Model = model<I{Domain}>('{Domain}', {Domain}Schema);
```

### Repository 템플릿
```typescript
// src/{domain}/repository/{domain}.repository.ts
import { {Domain}Model, I{Domain} } from '../{domain}.schema';

export class {Domain}Repository {
  async findById(id: string): Promise<I{Domain} | null> {
    return {Domain}Model.findById(id).lean().exec() as any;
  }

  async findAll(limit = 100, skip = 0): Promise<I{Domain}[]> {
    return {Domain}Model.find().limit(limit).skip(skip).lean().exec() as any;
  }

  async create(data: Partial<I{Domain}>): Promise<I{Domain}> {
    const entity = new {Domain}Model(data);
    return entity.save();
  }

  async update(id: string, data: Partial<I{Domain}>): Promise<I{Domain} | null> {
    return {Domain}Model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await {Domain}Model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
```

### Service 템플릿
```typescript
// src/{domain}/service/{domain}.service.ts
import { {Domain}Repository } from '../repository/{domain}.repository';
import { CacheManager } from '../../infrastructure/cache/cache-manager';

export class {Domain}Service {
  private repository = new {Domain}Repository();
  private cache = new CacheManager();

  async getById(id: string) {
    const cacheKey = `cache:{domain}:${id}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const entity = await this.repository.findById(id);
    
    if (entity) {
      await this.cache.set(cacheKey, entity, 3);
    }
    
    return entity;
  }

  async getAll(limit: number, skip: number) {
    return this.repository.findAll(limit, skip);
  }
}
```

### Router 템플릿
```typescript
// src/{domain}/router/{domain}.router.ts
import { Router } from 'express';
import { {Domain}Service } from '../service/{domain}.service';
import { cacheMiddleware } from '../../common/middleware/cache.middleware';

const router = Router();
const service = new {Domain}Service();

router.get('/:id', cacheMiddleware(3), async (req, res) => {
  try {
    const entity = await service.getById(req.params.id);
    
    if (!entity) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    res.json(entity);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', cacheMiddleware(3), async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const entities = await service.getAll(Number(limit), Number(skip));
    
    res.json({ data: entities, count: entities.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## 🗂️ 이 구조의 장점

### 1. 도메인 응집도
- 관련 코드가 한 폴더에 모임
- 도메인 이해/수정이 쉬움

### 2. 확장성
- 새 도메인 추가 시 폴더만 복사
- 템플릿 기반 빠른 생성

### 3. 의존성 명확
- 도메인 간 의존은 import로 확인
- 순환 참조 방지 쉬움

---

## 📦 폴더 생성 명령어 (최종)

```bash
# 도메인 폴더들
mkdir -p src/general/{repository,router,service}
mkdir -p src/city/{repository,router,service}
mkdir -p src/nation/{repository,router,service}
mkdir -p src/command/{repository,router,service}
mkdir -p src/battle/{repository,router,service,handlers}
mkdir -p src/item/{repository,router,service}

# 인프라
mkdir -p src/infrastructure/{cache,db,queue}

# 데몬
mkdir -p src/daemon

# 공통
mkdir -p src/common/{middleware,types,utils,constants}

# 설정
mkdir -p src/config
```

---

## 🎯 생성 후 확인

```bash
# 폴더 구조 확인
tree src -d -L 2

# 예상 출력:
# src
# ├── general
# │   ├── repository
# │   ├── router
# │   └── service
# ├── city
# │   ├── repository
# │   ├── router
# │   └── service
# ├── infrastructure
# │   ├── cache
# │   ├── db
# │   └── queue
# ...
```

---

## 📝 파일 생성 예시 (General 도메인)

### 1. Schema
```bash
touch src/general/general.schema.ts
touch src/general/general.types.ts
```

### 2. Repository
```bash
touch src/general/repository/general.repository.ts
```

### 3. Service
```bash
touch src/general/service/general.service.ts
```

### 4. Router
```bash
touch src/general/router/general.router.ts
```

### 모든 도메인에 반복
```bash
# City
touch src/city/{city.schema.ts,city.types.ts}
touch src/city/repository/city.repository.ts
touch src/city/service/city.service.ts
touch src/city/router/city.router.ts

# Nation
touch src/nation/{nation.schema.ts,nation.types.ts}
touch src/nation/repository/nation.repository.ts
touch src/nation/service/nation.service.ts
touch src/nation/router/nation.router.ts

# Command
touch src/command/{command.schema.ts,command.types.ts}
touch src/command/repository/command.repository.ts
touch src/command/service/command.service.ts
touch src/command/router/command.router.ts

# Battle
touch src/battle/{battle.schema.ts,battle.types.ts}
touch src/battle/repository/battle.repository.ts
touch src/battle/service/battle.service.ts
touch src/battle/router/battle.router.ts
touch src/battle/handlers/battle.handler.ts

# Item
touch src/item/{item.schema.ts,item.types.ts}
touch src/item/repository/item.repository.ts
touch src/item/service/item.service.ts
touch src/item/router/item.router.ts
```

---

## 🚀 구현 시작하기

1. **폴더 먼저 생성** (위 명령어 실행)
2. **IMPLEMENTATION_ROADMAP.md 참고하여 코드 작성**
3. **도메인별로 완성** (General → Command → City → ...)
4. **각 Phase 완료 후 테스트**

준비 완료!
