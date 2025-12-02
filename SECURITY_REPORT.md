# D1: Security Validation & Hardening Report

## 완료된 작업

### 1. Battle Routes 검증 (Completed)
- 모든 Battle 라우트에 `yup` 스키마 검증 적용
- `validation.middleware.ts`에 누락된 스키마 추가 (`battleAutoResolveSchema`, `battleSimulateSchema`, 등)
- `battle.routes.ts`에서 `validate` 및 `validateMultiple` 미들웨어 적용

### 2. 나머지 라우트 검증 (Completed)
- **General Routes**: `general.routes.ts`의 모든 엔드포인트에 검증 적용
- **Message Routes**: `message.routes.ts`의 모든 엔드포인트에 검증 적용
- **Auth Routes**: 기존 검증 확인

### 3. Rate Limiting 적용 (Completed)
- **Global Limiter**: 1000 req / 15 min (기본 적용)
- **Auth Limiter**: 5 req / 15 min (로그인/가입)
- **Battle Limiter**: 120 req / 1 min (RTS/Polling 대응)
- **General Limiter**: 60 req / 1 min (일반 명령)
- 각 라우터에 적절한 리미터 적용 완료

### 4. CSRF 방어 (Completed)
- **Double Submit Cookie** 패턴 구현 (`csrf.middleware.ts`)
- `server.ts`에 글로벌 미들웨어로 적용
- GET 요청 시 `XSRF-TOKEN` 쿠키 발급
- POST/PUT/DELETE/PATCH 요청 시 `X-XSRF-TOKEN` 헤더 검증
- 예외: `Authorization` 헤더(Bearer Token) 사용 시 검증 건너뜀 (API 클라이언트 지원)

## 보안 강화 사항
- NoSQL Injection 방지 (`preventMongoInjection`) 모든 POST 라우트에 적용
- Helmet 보안 헤더 적용 (기존)
- CORS 정책 적용 (기존)

## 추후 권장 사항
- 프론트엔드에서 `XSRF-TOKEN` 쿠키를 읽어 헤더에 포함하도록 수정 필요
- `admin.routes.ts` 등 관리자 기능에 대한 추가 검증 및 감사 로그 강화 필요



