# E2E 통합 테스트

이 디렉토리는 End-to-End 통합 테스트를 포함합니다.

## 실행 방법

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# 특정 테스트 파일 실행
npm run test -- src/__tests__/e2e/auth-flow.test.ts

# Watch 모드
npm run test:watch -- src/__tests__/e2e
```

## 테스트 파일

### auth-flow.test.ts
인증 플로우 테스트:
- 회원가입
- 로그인
- 토큰 검증
- 로그아웃
- 토큰 블랙리스트

### game-play-flow.test.ts
게임 플레이 플로우 테스트:
- 기본 정보 조회
- 맵 조회
- 장수 정보 조회
- 명령 예약
- 경매 조회
- 외교 서한 조회
- 전투 센터 조회

## 환경 설정

테스트 실행 전에 `.env.test` 파일을 생성하고 다음 변수를 설정하세요:

```env
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/sangokushi_test
JWT_SECRET=test-secret-key
```

## 주의사항

- 테스트는 실제 데이터베이스를 사용하므로, 테스트 전용 데이터베이스를 사용하는 것을 권장합니다.
- 각 테스트는 독립적으로 실행되어야 하므로, 테스트 간 데이터 격리가 필요합니다.
- 테스트 후 정리 작업이 필요할 수 있습니다.

