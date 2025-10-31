# Open SAM Backend

Express.js + TypeScript + MongoDB 기반 삼국지 게임 백엔드 서버

## 🚀 빠른 시작

### 설치
```bash
npm install
```

### 환경 변수 설정
```bash
cp .env.example .env
# .env 파일 수정
```

### 개발 서버 실행
```bash
# 터미널 1: API 서버
npm run dev

# 터미널 2: Game Daemon
npm run dev:daemon
```

### 빌드
```bash
npm run build
npm run typecheck
```

### 프로덕션 실행
```bash
npm start                # API 서버
npm run start:daemon     # Game Daemon
```

## 🏗️ 아키텍처

### CQRS 패턴
```
┌─────────────┐
│ API Server  │ (Read + Write 접수)
│ (N개 확장)  │
└──────┬──────┘
       │ publish
       ↓
┌─────────────────┐
│ Redis Streams   │
│ game:commands   │
└──────┬──────────┘
       │ consume
       ↓
┌─────────────┐
│ Game Daemon │ (Single Writer)
│ (커맨드 실행)│
└──────┬──────┘
       ↓
┌─────────────┐
│  MongoDB    │
└─────────────┘
```

### 3-Layer 캐싱
```
L1: NodeCache (10초, 메모리)
  ↓ miss
L2: Redis (60초)
  ↓ miss
L3: MongoDB (영구)
```

## 📁 프로젝트 구조

```
src/
├── commands/           # 93개 게임 커맨드
│   ├── general/       # 55개 장수 커맨드
│   └── nation/        # 38개 국가 커맨드
├── core/              # 핵심 시스템
│   └── command/       # 통합 커맨드 시스템
│       ├── CommandRegistry.ts
│       ├── CommandFactory.ts
│       ├── CommandExecutor.ts
│       └── CommandService.ts
├── repositories/      # 5개 Repository
│   ├── session.repository.ts
│   ├── general.repository.ts
│   ├── city.repository.ts
│   ├── nation.repository.ts
│   └── command.repository.ts
├── common/            # 공통 인프라
│   ├── logger.ts              # JSON 로깅
│   ├── errors/app-error.ts    # 에러 클래스
│   ├── cache/cache.service.ts # 캐시 서비스
│   ├── dto/                   # 4개 DTO 스키마
│   └── middleware/            # 미들웨어
├── infrastructure/    # 인프라
│   └── queue/        # Redis Streams
│       ├── redis.service.ts
│       └── command-queue.ts
├── models/           # Mongoose 모델
├── services/         # 비즈니스 로직
├── cache/            # 캐시 매니저
├── server.ts         # API 서버
└── daemon.ts         # Game Daemon
```

## 🎮 커맨드 시스템

### 커맨드 타입
- **General Commands** (55개): 장수 행동
  - 내정, 훈련, 인사, 이동, 군사, 전투, 국가, 물자
- **Nation Commands** (38개): 국가 정책
  - 관리, 외교, 전략, 특수병과 연구

### 사용 예시
```typescript
// 커맨드 제출
const command = await CommandService.submit({
  sessionId: 'sangokushi_default',
  generalId: 'general_123',
  category: 'general',
  type: 'TRAIN',
  arg: { statType: 'leadership' }
});

// 커맨드 조회
const commands = await CommandService.getByGeneral(sessionId, generalId);

// 커맨드 취소
await CommandService.cancel(commandId);
```

## 🔧 주요 기능

### 1. 통합 커맨드 시스템
- CommandRegistry: 93개 커맨드 자동 등록
- CommandFactory: 타입 기반 생성
- CommandExecutor: 실행 파이프라인
- CommandService: API 통합

### 2. CQRS
- API Server: 읽기 + 커맨드 발행
- Game Daemon: 단일 Writer
- Redis Streams: 메시지 큐
- 비동기 처리

### 3. 3-Layer 캐싱
- L1: NodeCache (메모리, 10초)
- L2: Redis (60초)
- L3: MongoDB (영구)

### 4. Repository 패턴
- 데이터 접근 계층 분리
- 캐시 통합
- 테스트 가능

### 5. DTO Validation
- Yup 스키마 자동 검증
- 타입 안전 요청 처리

### 6. 구조화된 로깅
- JSON 형식
- requestId 추적
- 메타데이터 지원

## 📚 문서

- [프로젝트 문서](./docs/README.md)
- [아키텍처](./docs/architecture/ARCHITECTURE_FINAL.md)
- [구현 가이드](./docs/implementation/)
- [CQRS 완성](./docs/implementation/CQRS_COMPLETE.md)

## 🛠️ 개발 명령어

```bash
npm run dev              # API 서버 개발 모드
npm run dev:daemon       # Daemon 개발 모드
npm run build            # 프로덕션 빌드
npm run typecheck        # 타입 체크
npm start                # API 서버 시작
npm run start:daemon     # Daemon 시작
```

## 🎯 기술 스택

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Cache**: Redis + NodeCache
- **Queue**: Redis Streams
- **Validation**: Yup
- **Logging**: 구조화된 JSON

## 📊 통계

- **커맨드**: 93개 (General 55 + Nation 38)
- **Repository**: 5개
- **DTO**: 4개
- **파일 수**: ~500개
- **코드 라인**: ~15,000+

## ✨ 특징

- ✅ 타입 안전 TypeScript
- ✅ CQRS 아키텍처
- ✅ 3단계 캐싱
- ✅ Repository 패턴
- ✅ DTO Validation
- ✅ 구조화된 로깅
- ✅ 중앙집중식 에러 처리
- ✅ 수평 확장 가능
- ✅ 테스트 가능한 구조

## 🔐 보안

- Helmet (보안 헤더)
- CORS 설정
- DTO 검증 (stripUnknown)
- 에러 스택 숨김 (프로덕션)
- requestId 추적

## 📝 라이센스

MIT

---

**Made with ❤️ using TypeScript + Express + MongoDB**
