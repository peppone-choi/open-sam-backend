# TODO List

스켈레톤 구조가 생성되었습니다. 아래 항목들을 순차적으로 구현하세요.

## ⚡ 우선순위 HIGH

### 1. 패키지 설치
```bash
npm install yup
npm install --save-dev @types/yup
```

### 2. Yup 검증 미들웨어 활성화
파일: `src/common/middleware/validator.middleware.ts`
- [ ] Yup import 주석 해제
- [ ] validate 함수 실제 로직 구현
- [ ] 에러 메시지 포맷팅

### 3. General DTO 스키마 작성
파일: `src/api/general/dto/train-general.dto.ts` (신규 생성)
```typescript
import { object, string, number } from 'yup';

export const TrainGeneralSchema = object({
  body: object({
    statType: string()
      .oneOf(['leadership', 'strength', 'intel', 'politics'])
      .required(),
    amount: number().min(1).max(100).required(),
  }),
});
```

### 4. Command DTO 스키마 작성
파일: `src/api/command/dto/submit-command.dto.ts` (신규 생성)
```typescript
import { object, string, mixed } from 'yup';

export const SubmitCommandSchema = object({
  body: object({
    generalId: string().required(),
    type: string()
      .oneOf([
        'MOVE',
        'PRODUCE',
        'RECRUIT',
        'TRAIN_GENERAL',
        'EQUIP_ITEM',
        'BUILD',
        'RESEARCH',
        'DIPLOMACY',
        'ESPIONAGE',
        'ATTACK',
      ])
      .required(),
    payload: mixed().required(),
  }),
});
```

### 5. Container 팩토리 활성화
파일: `src/container.ts`
- [ ] General import 주석 해제
- [ ] makeGeneralController 구현
- [ ] Command import 주석 해제
- [ ] makeCommandController 구현

### 6. General Router 활성화
파일: `src/api/general/router/general.router.ts`
- [ ] Controller DI 주석 해제
- [ ] 라우트 주석 해제
- [ ] 임시 라우트 제거

### 7. Command Router 활성화
파일: `src/api/command/router/command.router.ts`
- [ ] Controller DI 주석 해제
- [ ] 라우트 주석 해제
- [ ] 임시 라우트 제거

---

## 🔧 우선순위 MEDIUM

### 8. Redis Streams CommandQueue 구현
파일: `src/infrastructure/queue/command-queue.ts`
- [ ] `consume()` 메서드 구현
  - XGROUP CREATE (없으면)
  - XREADGROUP 구현
  - ACK 처리
  - 에러 핸들링 및 재시도
- [ ] `getPending()` 메서드 구현

### 9. CommandProcessor 구현
파일: `src/api/daemon/command-processor.ts`
- [ ] CommandQueue.consume 연결
- [ ] 명령 타입별 핸들러 라우팅
- [ ] 에러 로깅 및 DLQ

### 10. TurnHandler 구현
파일: `src/api/daemon/handlers/turn.handler.ts` (신규 생성)
- [ ] handleTrainGeneral - CP 차감, 스탯 증가
- [ ] handleEquipItem - 장비 착용
- [ ] 트랜잭션 처리
- [ ] 캐시 무효화

### 11. GameLoop 구현
파일: `src/api/daemon/game-loop.ts`
- [ ] 100ms tick 로직
- [ ] 완료 예정 Command 확인
- [ ] 이동/생산 진행률 업데이트

### 12. 캐시 무효화 Pub/Sub
- [ ] Daemon에서 상태 변경 시 CacheManager.invalidate() 호출
- [ ] API 서버에서 Redis Pub/Sub 구독 확인

---

## 📦 우선순위 LOW

### 13. City 도메인 구현
General 패턴을 복사하여 구현:
- [ ] city.schema.ts
- [ ] CityRepository
- [ ] CityService
- [ ] CityController
- [ ] city.router.ts
- [ ] makeCityController in container.ts

### 14. Nation 도메인 구현
- [ ] nation.schema.ts
- [ ] 3계층 구조
- [ ] Router 연결

### 15. Battle 도메인 구현
- [ ] battle.schema.ts
- [ ] 3계층 구조
- [ ] Router 연결

### 16. Item 도메인 구현
- [ ] item.schema.ts
- [ ] 3계층 구조
- [ ] Router 연결

---

## 🧪 테스트

### 17. 단위 테스트 작성
- [ ] GeneralService 테스트
- [ ] CommandService 테스트
- [ ] CacheManager 테스트

### 18. 통합 테스트
- [ ] API 엔드포인트 테스트
- [ ] Redis Streams 발행/소비 테스트
- [ ] Daemon 명령 처리 테스트

---

## 🚀 최종 검증

### 19. 체크리스트
- [ ] 모든 라우트가 Controller → Service → Repository 경로로 동작
- [ ] API 서버에서 DB 직접 쓰기 금지 확인
- [ ] 모든 write 엔드포인트에 Yup 검증 적용
- [ ] HttpException으로 에러 수렴 확인
- [ ] Daemon이 모든 상태 변경 수행
- [ ] Redis Streams ACK 로깅 확인

### 20. 성능 테스트
- [ ] 캐시 히트율 확인
- [ ] Command 처리 지연시간 측정
- [ ] 동시 접속 부하 테스트

---

## 📋 참고 문서
- REFACTORING_GUIDE.md - 전체 리팩토링 가이드
- FOLDER_STRUCTURE.md - 기존 폴더 구조
- sangokushi-express-architecture.md - 아키텍처 설계
- sam.md - 게임 로직 상세

---

**마지막 업데이트**: 2025-01-27
