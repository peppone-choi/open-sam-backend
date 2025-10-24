# 폴더 구조 가이드 (도메인 중심)

## 🎯 참고 케이스 기반 설계

숙박 예약 시스템의 깔끔한 도메인 분리 구조를 참고하여 설계합니다.

---

## 📁 최종 폴더 구조

```
src/
├── api/                      # 공통 API 관련
│   ├── middleware/
│   │   ├── cache.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── auth.middleware.ts
│   └── index.ts
│
├── db/                       # DB 연결 및 공통
│   └── connection.ts
│
├── utils/                    # 유틸리티
│   ├── logger.ts
│   ├── time.util.ts
│   └── redis.util.ts
│
├── @types/                   # 공통 타입 정의
│   ├── common.types.ts
│   ├── redis.types.ts
│   └── index.ts
│
├── auth/                     # 인증 (선택)
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   └── jwt.util.ts
│
├── general/                  # 장수 도메인
│   ├── general.schema.ts
│   ├── general.repository.ts
│   ├── general.service.ts
│   ├── general.controller.ts
│   ├── general.routes.ts
│   └── general.types.ts
│
├── city/                     # 도시 도메인
│   ├── city.schema.ts
│   ├── city.repository.ts
│   ├── city.service.ts
│   ├── city.controller.ts
│   ├── city.routes.ts
│   └── city.types.ts
│
├── nation/                   # 국가 도메인
│   ├── nation.schema.ts
│   ├── nation.repository.ts
│   ├── nation.service.ts
│   ├── nation.controller.ts
│   ├── nation.routes.ts
│   └── nation.types.ts
│
├── battle/                   # 전투 도메인
│   ├── battle.schema.ts
│   ├── battle.repository.ts
│   ├── battle.service.ts
│   ├── battle.controller.ts
│   ├── battle.routes.ts
│   ├── battle.engine.ts      # RTS 전투 엔진
│   └── battle.types.ts
│
├── command/                  # 명령 도메인
│   ├── command.schema.ts
│   ├── command.repository.ts
│   ├── command.service.ts
│   ├── command.controller.ts
│   ├── command.routes.ts
│   └── command.types.ts
│
├── item/                     # 아이템 도메인
│   ├── item.schema.ts
│   ├── item.repository.ts
│   ├── item.service.ts
│   ├── item.controller.ts
│   ├── item.routes.ts
│   └── item.types.ts
│
├── event/                    # 이벤트 도메인 (게임 이벤트 저장)
│   ├── event.schema.ts
│   ├── event.repository.ts
│   ├── event.service.ts
│   └── event.types.ts
│
├── cache/                    # 캐시 서비스
│   ├── redis.service.ts
│   ├── l1-cache.service.ts
│   └── cache-manager.ts
│
├── daemon/                   # 데몬 (단일 Writer)
│   ├── game-loop.ts
│   ├── command-processor.ts
│   ├── persist-scheduler.ts
│   └── handlers/
│       ├── train.handler.ts
│       ├── move.handler.ts
│       └── battle.handler.ts
│
├── server.ts                 # API 서버 엔트리포인트
└── daemon.ts                 # Daemon 엔트리포인트
```

---

## 🛠️ 폴더 생성 명령어

```bash
# 공통 레이어
mkdir -p src/api/middleware
mkdir -p src/db
mkdir -p src/utils
mkdir -p src/@types
mkdir -p src/auth

# 도메인 (7개)
mkdir -p src/general
mkdir -p src/city
mkdir -p src/nation
mkdir -p src/battle
mkdir -p src/command
mkdir -p src/item
mkdir -p src/event

# 인프라
mkdir -p src/cache
mkdir -p src/daemon/handlers
```

---

## 📝 각 도메인 폴더의 파일 패턴

모든 도메인은 동일한 패턴을 따릅니다:

```
{domain}/
├── {domain}.schema.ts        # Mongoose 스키마
├── {domain}.repository.ts    # DB 접근 레이어
├── {domain}.service.ts       # 비즈니스 로직
├── {domain}.controller.ts    # HTTP 컨트롤러
├── {domain}.routes.ts        # Express 라우터
└── {domain}.types.ts         # 타입 정의
```

### 예시: general/ 도메인

```
general/
├── general.schema.ts         # GeneralModel (Mongoose)
├── general.repository.ts     # GeneralRepository (CRUD)
├── general.service.ts        # GeneralService (비즈니스 로직)
├── general.controller.ts     # GET /generals/:id 등
├── general.routes.ts         # Router 정의
└── general.types.ts          # IGeneral, GeneralDTO 등
```

---

## 🔄 라우터 통합 방식

**src/api/index.ts**
```typescript
import { Router } from 'express';
import generalRoutes from '../general/general.routes';
import cityRoutes from '../city/city.routes';
import nationRoutes from '../nation/nation.routes';
import battleRoutes from '../battle/battle.routes';
import commandRoutes from '../command/command.routes';
import itemRoutes from '../item/item.routes';

const router = Router();

router.use('/generals', generalRoutes);
router.use('/cities', cityRoutes);
router.use('/nations', nationRoutes);
router.use('/battles', battleRoutes);
router.use('/commands', commandRoutes);
router.use('/items', itemRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

export default router;
```

**src/server.ts**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import apiRoutes from './api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// 모든 API는 /api 프리픽스
app.use('/api', apiRoutes);

async function start() {
  await mongoConnection.connect(process.env.MONGODB_URI!);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
```

---

## 🎯 장점

### 1. 도메인 응집도 높음
- 한 도메인의 모든 코드가 한 폴더에
- 파일 찾기 쉬움
- 수정 시 영향 범위 명확

### 2. 확장 용이
- 새 도메인 추가: 폴더 하나만 추가
- 패턴이 동일해서 학습 곡선 낮음

### 3. 레이어 분리 명확
- schema → repository → service → controller → routes
- 각 레이어의 책임 명확

---

## 📦 의존성 설치

```bash
# Redis
npm install ioredis
npm install --save-dev @types/ioredis

# 검증 (선택)
npm install joi
npm install --save-dev @types/joi
```

---

## ✅ 생성 순서 (추천)

### 1단계: 기본 인프라
```bash
mkdir -p src/{db,utils,@types,cache,api/middleware}
```

파일:
1. `src/db/connection.ts`
2. `src/utils/logger.ts`
3. `src/cache/redis.service.ts`
4. `src/cache/l1-cache.service.ts`
5. `src/cache/cache-manager.ts`
6. `src/api/middleware/cache.middleware.ts`
7. `src/api/middleware/error.middleware.ts`

### 2단계: 첫 번째 도메인 (general)
```bash
mkdir -p src/general
```

파일:
1. `src/general/general.schema.ts`
2. `src/general/general.repository.ts`
3. `src/general/general.service.ts`
4. `src/general/general.controller.ts`
5. `src/general/general.routes.ts`
6. `src/general/general.types.ts`

### 3단계: API 통합
파일:
1. `src/api/index.ts`
2. `src/server.ts` (업데이트)

### 4단계: 나머지 도메인
```bash
mkdir -p src/{city,nation,battle,command,item,event}
```

각 도메인마다 6개 파일 동일 패턴으로 생성

### 5단계: Daemon
```bash
mkdir -p src/daemon/handlers
```

파일:
1. `src/daemon/game-loop.ts`
2. `src/daemon/command-processor.ts`
3. `src/daemon/persist-scheduler.ts`
4. `src/daemon/handlers/train.handler.ts`
5. `src/daemon/handlers/move.handler.ts`
6. `src/daemon.ts` (업데이트)

---

## 🚀 빠른 시작 (최소 구성)

급하게 1개 도메인만 테스트:

```bash
# 최소 폴더
mkdir -p src/{db,utils,cache,api/middleware,general}

# 파일 7개만 생성
# 1. src/db/connection.ts
# 2. src/utils/logger.ts
# 3. src/cache/redis.service.ts
# 4. src/general/general.schema.ts
# 5. src/general/general.controller.ts
# 6. src/general/general.routes.ts
# 7. src/api/index.ts (general routes만 등록)
```

---

## 📚 코드는 IMPLEMENTATION_ROADMAP.md 참고

각 파일의 전체 코드는 [IMPLEMENTATION_ROADMAP.md](file:///mnt/c/Users/user/Desktop/open-sam-backend/IMPLEMENTATION_ROADMAP.md)에 있습니다.
