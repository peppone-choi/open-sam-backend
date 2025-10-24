# 삼국지 게임 백엔드 (Express.js + TypeScript)

**CQRS + Single Writer + DDD + Event-Driven Architecture**

## 📚 아키텍처 문서

- [sam.md](./sam.md) - 게임 시스템 상세 설계
- [sangokushi-express-architecture.md](./sangokushi-express-architecture.md) - Express.js 아키텍처 가이드
- [AGENTS.md](./AGENTS.md) - 개발 가이드 (빌드, 테스트, 코드 스타일)

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 필요한 값 수정
```

### 3. 데이터베이스 설정

```bash
# Prisma 마이그레이션
npx prisma migrate dev

# Prisma Client 생성
npx prisma generate

# (선택) Prisma Studio로 DB 확인
npx prisma studio
```

### 4. 개발 서버 실행

```bash
# API 서버 (읽기 전용)
npm run dev

# Game Daemon (별도 터미널에서)
npm run dev:daemon
```

### 5. Docker Compose로 전체 스택 실행

```bash
docker-compose up -d
```

## 🏗️ 프로젝트 구조

```
src/
├── api/                    # API 서버 (읽기 전용, N개 인스턴스)
│   ├── controllers/        # 컨트롤러
│   ├── routes/            # 라우트
│   ├── middleware/        # 미들웨어
│   └── app.ts             # Express 앱
├── daemon/                # Game Daemon (단일 Writer)
│   ├── game-loop.ts       # 100ms 게임 루프
│   ├── command-processor.ts
│   └── handlers/          # 턴, 전투, 이벤트 핸들러
├── domain/                # 도메인 계층 (DDD)
│   ├── general/           # 장수
│   ├── city/              # 도시
│   ├── command/           # 커맨드
│   └── ...
├── infrastructure/        # 인프라 계층
│   ├── database/          # Prisma
│   └── cache/             # 2-tier 캐시
└── shared/                # 공유 코드
```

## 🔧 주요 기술 스택

- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5+
- **ORM**: Prisma 5+
- **Database**: PostgreSQL 16
- **Cache**: node-cache + Redis 7
- **Queue**: Redis Streams
- **DI**: tsyringe
- **Validation**: class-validator

## 📖 주요 개념

### CQRS (Command Query Responsibility Segregation)

- **API Server**: 읽기 전용, N개 인스턴스, 2-tier 캐시
- **Game Daemon**: 쓰기 전용, 1개 인스턴스, 단일 Writer

### 커맨드 시스템

1. 클라이언트가 API 서버에 요청
2. API 서버가 Redis Streams에 커맨드 발행
3. Game Daemon이 커맨드 처리 (DB 쓰기)
4. 결과를 Redis Pub/Sub으로 알림

### 게임 시간 (24배속)

- 실시간 1시간 = 게임 내 1일
- 실시간 24시간 = 게임 내 24일

## 🧪 테스트

```bash
# 전체 테스트
npm test

# Watch 모드
npm run test:watch

# 커버리지
npm run test:coverage
```

## 📝 개발 가이드

### TODO 구현 우선순위

1. **Infrastructure 계층**
   - RedisService 구현 (connect, get, set, streams)
   - CacheManager 구현 (2-tier 캐시)

2. **Domain 계층**
   - Repository 구현 (findById, findAll, save)
   - Service 구현 (비즈니스 로직)

3. **Game Daemon**
   - CommandProcessor (Redis Streams XREADGROUP)
   - GameLoop (턴 진행, 커맨드 완료 확인)

4. **API Server**
   - Controller 구현 (쿼리, 커맨드 발행)
   - Middleware 구현 (인증, 검증, 캐싱)

### 구현 힌트

- **Redis Streams**: `XADD`, `XREADGROUP`, `XACK` 사용
- **캐시 무효화**: Redis Pub/Sub으로 모든 API 서버에 알림
- **게임 시간**: `Date.now() * 24` 로 계산
- **DI**: `@injectable()` 데코레이터 사용

## 📦 배포

### Docker Compose (단일 서버)

```bash
docker-compose up -d
```

### PM2 (프로세스 매니저)

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
```

## 🔗 유용한 링크

- Health Check: http://localhost:3000/health
- Prisma Studio: `npx prisma studio`
- API Docs: TODO (Swagger/OpenAPI)

## 📄 라이선스

MIT
