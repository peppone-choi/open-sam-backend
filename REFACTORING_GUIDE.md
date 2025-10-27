# 리팩토링 가이드

blackandwhite-dev-back 패턴을 적용한 스켈레톤 구조가 생성되었습니다.

## 📋 완료된 작업

### ✅ Phase 0: 공통 레이어
- [x] HttpException 커스텀 예외 클래스
- [x] errorMiddleware 중앙 에러 핸들링
- [x] validator.middleware Yup 기반 검증 (스켈레톤)
- [x] asyncHandler 비동기 핸들러 유틸

### ✅ Phase 1: @types 중앙화
- [x] @types/http.ts - ApiResponse, Paginated, ErrorResponse
- [x] @types/domain/general.ts - IGeneral, DTO
- [x] @types/domain/command.ts - ICommand, CommandType, DTO
- [x] @types/domain/city.ts - ICity

### ✅ Phase 2: Infrastructure
- [x] RedisService (L2 캐시 + Pub/Sub + Streams)
- [x] L1CacheService (node-cache)
- [x] CacheManager (2-Tier 캐시)
- [x] CommandQueue (Redis Streams)

### ✅ Phase 3: DI Container
- [x] container.ts - 싱글톤 팩토리 및 Controller 생성기

### ✅ Phase 4: General 도메인 (예시)
- [x] general.schema.ts - Mongoose 스키마
- [x] GeneralRepository - 데이터 접근 계층
- [x] GeneralService - 비즈니스 로직 (읽기 + Command 발행)
- [x] GeneralController - 요청/응답 처리
- [x] general.router.ts - 라우트 정의

### ✅ Phase 5: Command 도메인
- [x] command.schema.ts - Mongoose 스키마
- [x] CommandRepository - 데이터 접근 계층
- [x] CommandService - 명령 발행 + 조회
- [x] CommandController - 요청/응답 처리
- [x] command.router.ts - 라우트 정의

### ✅ Phase 6: 라우터 통합
- [x] api/index.ts - mountRoutes 통합 함수
- [x] server.ts 연결
- [x] daemon.ts 연결

---

## 🔧 구현해야 할 TODO

### 1. 패키지 설치
```bash
npm install yup
npm install --save-dev @types/yup
```

### 2. validator.middleware.ts 구현
- [ ] Yup import 활성화
- [ ] validate 함수 실제 검증 로직 구현

### 3. DTO 스키마 작성
- [ ] General: TrainGeneralSchema (Yup)
- [ ] Command: SubmitCommandSchema (Yup)
- [ ] City: 필요 시 DTO 추가

### 4. container.ts 팩토리 활성화
```typescript
// TODO: General Controller 팩토리
export const makeGeneralController = () => {
  const repo = new GeneralRepository();
  const service = new GeneralService(repo, getCacheManager(), getCommandQueue());
  return new GeneralController(service);
};

// TODO: Command Controller 팩토리
export const makeCommandController = () => {
  const repo = new CommandRepository();
  const service = new CommandService(repo, getCommandQueue());
  return new CommandController(service);
};
```

### 5. Router 활성화
- [ ] general.router.ts - Controller DI 연결
- [ ] command.router.ts - Controller DI 연결
- [ ] city.router.ts - 구현 (General 패턴 참고)

### 6. Redis Streams 구현
- [ ] CommandQueue.consume() - XREADGROUP 구현
- [ ] Consumer Group 생성 로직
- [ ] ACK 처리
- [ ] 재시도 로직

### 7. Daemon 핸들러 구현
- [ ] CommandProcessor - Redis Streams 소비
- [ ] TurnHandler - 턴 처리 (CP 차감, 상태 변경)
- [ ] BattleHandler - 전투 처리
- [ ] GameLoop - 100ms tick 로직

### 8. 캐시 무효화 Pub/Sub
- [ ] Daemon에서 상태 변경 시 invalidate 호출
- [ ] API 서버에서 구독 및 L1 캐시 삭제

### 9. 나머지 도메인 적용
- [ ] City 3계층 구조 (General 패턴 참고)
- [ ] Nation 3계층 구조
- [ ] Battle 3계층 구조
- [ ] Item 3계층 구조

---

## 🎯 핵심 패턴 (반드시 준수)

### 1. CQRS + Single Writer
- ✅ **읽기**: API 서버 → Repository + Cache
- ✅ **쓰기**: API 서버 → CommandQueue 발행 → Daemon 처리
- ❌ **금지**: API 서버에서 DB 직접 변경

### 2. 3계층 아키텍처
```
Controller (요청/응답)
    ↓
Service (비즈니스 로직)
    ↓
Repository (데이터 접근)
```

### 3. 의존성 주입 (생성자 DI)
```typescript
const repo = new GeneralRepository();
const service = new GeneralService(repo, cacheManager, commandQueue);
const controller = new GeneralController(service);
```

### 4. 에러 핸들링
- `HttpException` 사용
- `errorMiddleware`가 최종 처리
- `asyncHandler`로 try/catch 자동화

### 5. 검증
- Yup 스키마로 DTO 정의
- `validate(schema)` 미들웨어 적용
- Controller는 검증된 데이터만 받음

---

## 📁 파일 구조

```
src/
├── @types/                    # 타입 중앙 관리
│   ├── http.ts
│   ├── domain/
│   │   ├── general.ts
│   │   ├── command.ts
│   │   └── city.ts
│   └── index.ts
│
├── common/                    # 공통 레이어
│   ├── errors/
│   │   └── HttpException.ts
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   └── validator.middleware.ts
│   └── utils/
│       └── async-handler.ts
│
├── infrastructure/            # 인프라 레이어
│   ├── cache/
│   │   ├── redis.service.ts
│   │   ├── l1-cache.service.ts
│   │   └── cache-manager.ts
│   └── queue/
│       └── command-queue.ts
│
├── api/                       # 도메인별 모듈
│   ├── index.ts              # 라우터 통합
│   ├── general/
│   │   ├── general.schema.ts
│   │   ├── repository/
│   │   │   └── general.repository.ts
│   │   ├── service/
│   │   │   └── general.service.ts
│   │   ├── controller/
│   │   │   └── general.controller.ts
│   │   └── router/
│   │       └── general.router.ts
│   ├── command/
│   │   └── (동일 구조)
│   └── city/
│       └── (동일 구조)
│
├── container.ts              # DI 팩토리
├── server.ts                 # API 서버
└── daemon.ts                 # Game Daemon
```

---

## 🚀 다음 단계

1. **Yup 설치 및 검증 미들웨어 구현**
2. **General 도메인 완전 구현 및 테스트**
3. **Command 도메인 Redis Streams 연결**
4. **Daemon CommandProcessor 구현**
5. **City 도메인 적용** (General 패턴 복사)
6. **나머지 도메인 순차 적용**

---

## 📝 참고 자료

- blackandwhite-dev-back 저장소: https://github.com/blackandwhite-developers/blackandwhite-dev-back
- Oracle 분석 결과: CQRS + Single Writer + 3계층 아키텍처
- 기존 문서: FOLDER_STRUCTURE.md, sangokushi-express-architecture.md, sam.md

---

**생성일**: 2025-01-27
**패턴**: blackandwhite-dev-back 기반 3계층 아키텍처
**목표**: CQRS + Single Writer 패턴 완전 적용
