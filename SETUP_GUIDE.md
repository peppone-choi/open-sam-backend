# 셋업 가이드 - 폴더 및 파일 생성

## 📁 현재 상태
```
src/
├── daemon.ts
└── server.ts
```

---

## 🛠️ Phase 1: 폴더 구조 생성

### 1.1 기본 폴더 생성
```bash
# DB 관련
mkdir -p src/db/schemas
mkdir -p src/db/repositories

# Infrastructure
mkdir -p src/infrastructure/cache
mkdir -p src/infrastructure/queue
mkdir -p src/infrastructure/events

# API
mkdir -p src/api/routes
mkdir -p src/api/controllers
mkdir -p src/api/middleware
mkdir -p src/api/dto

# Daemon
mkdir -p src/daemon/handlers

# Domain
mkdir -p src/domain/general
mkdir -p src/domain/city
mkdir -p src/domain/nation
mkdir -p src/domain/command

# Shared
mkdir -p src/shared/types
mkdir -p src/shared/utils
mkdir -p src/shared/constants

# Config
mkdir -p src/config
```

### 1.2 최종 폴더 구조
```
src/
├── server.ts
├── daemon.ts
├── db/
│   ├── schemas/
│   │   ├── general.schema.ts
│   │   ├── city.schema.ts
│   │   ├── nation.schema.ts
│   │   ├── battle.schema.ts
│   │   ├── command.schema.ts
│   │   ├── item.schema.ts
│   │   ├── event.schema.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── general.repository.ts
│   │   ├── city.repository.ts
│   │   ├── nation.repository.ts
│   │   ├── command.repository.ts
│   │   └── index.ts
│   └── connection.ts
├── infrastructure/
│   ├── cache/
│   │   ├── redis.service.ts
│   │   ├── l1-cache.service.ts
│   │   └── cache-manager.ts
│   ├── queue/
│   │   └── command-queue.service.ts
│   └── events/
│       └── event-bus.service.ts
├── api/
│   ├── routes/
│   │   ├── general.routes.ts
│   │   ├── city.routes.ts
│   │   ├── command.routes.ts
│   │   └── index.ts
│   ├── controllers/
│   │   ├── general.controller.ts
│   │   ├── city.controller.ts
│   │   └── command.controller.ts
│   ├── middleware/
│   │   ├── cache.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── auth.middleware.ts
│   └── dto/
│       ├── command.dto.ts
│       └── response.dto.ts
├── daemon/
│   ├── game-loop.ts
│   ├── command-processor.ts
│   ├── persist-scheduler.ts
│   └── handlers/
│       ├── train.handler.ts
│       ├── move.handler.ts
│       └── battle.handler.ts
├── domain/
│   ├── general/
│   │   ├── general.entity.ts
│   │   ├── general.service.ts
│   │   └── general.types.ts
│   ├── city/
│   ├── nation/
│   └── command/
├── shared/
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── time.util.ts
│   │   └── logger.ts
│   └── constants/
│       └── game-config.ts
└── config/
    ├── database.config.ts
    ├── redis.config.ts
    └── app.config.ts
```

---

## 📦 Phase 2: 의존성 설치

### 2.1 Redis 관련
```bash
npm install ioredis
npm install --save-dev @types/ioredis
```

### 2.2 추가 유틸리티 (선택)
```bash
# 검증
npm install joi
npm install --save-dev @types/joi

# 또는 class-validator
npm install class-validator class-transformer

# DI (선택)
npm install tsyringe
npm install reflect-metadata
```

---

## 📝 Phase 3: 파일 생성 순서 (추천)

### 우선순위 1: 인프라 (필수)
1. `src/shared/utils/logger.ts` (로거)
2. `src/infrastructure/cache/redis.service.ts` (Redis)
3. `src/infrastructure/cache/l1-cache.service.ts` (L1 캐시)
4. `src/infrastructure/cache/cache-manager.ts` (2-Tier)
5. `src/db/connection.ts` (MongoDB)

### 우선순위 2: 스키마 & 레포지토리
6. `src/db/schemas/general.schema.ts`
7. `src/db/schemas/city.schema.ts`
8. `src/db/schemas/nation.schema.ts`
9. `src/db/schemas/command.schema.ts`
10. `src/db/schemas/event.schema.ts`
11. `src/db/schemas/index.ts` (export)
12. `src/db/repositories/general.repository.ts`
13. `src/db/repositories/command.repository.ts`
14. `src/db/repositories/index.ts` (export)

### 우선순위 3: API
15. `src/api/middleware/cache.middleware.ts`
16. `src/api/middleware/error.middleware.ts`
17. `src/api/controllers/general.controller.ts`
18. `src/api/routes/general.routes.ts`
19. `src/api/routes/index.ts`
20. `src/server.ts` (업데이트)

### 우선순위 4: Game Daemon
21. `src/daemon/handlers/train.handler.ts`
22. `src/daemon/handlers/move.handler.ts`
23. `src/daemon/command-processor.ts`
24. `src/daemon/game-loop.ts`
25. `src/daemon/persist-scheduler.ts`
26. `src/daemon.ts` (업데이트)

---

## 🔧 Phase 4: 설정 파일

### .env
```bash
# 프로젝트 루트에 .env 파일 생성
touch .env
```

```env
PORT=3000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/sangokushi
REDIS_URL=redis://localhost:6379

GAME_SPEED=24
```

### tsconfig.json (이미 있음)
현재 설정 그대로 사용

---

## ✅ 생성 확인

### 폴더 구조 확인
```bash
tree src -I node_modules
```

### 파일 개수 확인
```bash
find src -type f -name "*.ts" | wc -l
```

---

## 🎯 빠른 시작 (최소 구성)

급하게 테스트만 하고 싶다면:

```bash
# 최소 폴더만 생성
mkdir -p src/infrastructure/cache
mkdir -p src/db/schemas
mkdir -p src/api/routes

# Redis 설치
npm install ioredis @types/ioredis

# 최소 3개 파일만 생성
# 1. src/infrastructure/cache/redis.service.ts
# 2. src/db/schemas/general.schema.ts
# 3. src/api/routes/general.routes.ts
```

---

## 📚 참고: 각 파일의 내용은?

**IMPLEMENTATION_ROADMAP.md** 문서에 모든 파일의 전체 코드가 포함되어 있습니다.

각 파일을 생성할 때 해당 문서를 참고하세요.

---

## 🚨 주의사항

1. **폴더 먼저, 파일 나중**: 폴더를 모두 만든 후 파일 생성
2. **순서 중요**: 인프라 → 스키마 → API → Daemon 순서로
3. **테스트 가능**: 각 Phase 완료 후 실행해서 에러 확인
4. **Git 커밋**: Phase 단위로 커밋하면 롤백 쉬움

---

## 🎉 완료 후

모든 파일 생성 완료 후:

```bash
# TypeScript 컴파일 확인
npm run typecheck

# 개발 서버 실행
npm run dev

# Daemon 실행
npm run dev:daemon
```
