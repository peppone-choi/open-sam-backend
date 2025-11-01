# OpenSAM Backend API 문서

> **최종 업데이트**: 2025-11-01
> **API 버전**: 1.0.0
> **서버 포트**: 8080

## 📚 문서 개요

OpenSAM Backend는 삼국지 턴제 게임을 위한 RESTful API를 제공합니다.
완전히 동적인 게임 시스템으로 MongoDB + Redis CQRS 패턴을 사용합니다.

### 주요 특징

- ✅ **완전 문서화**: 모든 엔드포인트에 상세한 Swagger/JSDoc 문서
- ✅ **JWT 인증**: Bearer 토큰 기반 보안 인증
- ✅ **실시간 업데이트**: Socket.IO WebSocket 지원
- ✅ **동적 스키마**: MongoDB의 유연한 데이터 구조
- ✅ **캐싱**: Redis를 통한 고성능 캐싱

## 🌐 API 접근

### 개발 서버
```
http://localhost:8080
```

### Swagger UI (인터랙티브 API 문서)
```
http://localhost:8080/api-docs
```

### OpenAPI JSON
```
http://localhost:8080/api-docs.json
```

## 🔐 인증

### JWT Bearer Token

대부분의 API는 JWT 인증이 필요합니다.

#### 1. 로그인하여 토큰 받기

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "player1",
  "password": "password123"
}

# Response
{
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "507f1f77bcf86cd799439011"
}
```

#### 2. API 요청 시 토큰 사용

```bash
GET /api/general/list
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 3. Swagger UI에서 인증

1. Swagger UI 우측 상단 "Authorize" 버튼 클릭
2. 토큰 입력 (Bearer 접두사 불필요)
3. "Authorize" 클릭
4. 이제 모든 API 테스트 가능

## 📁 API 카테고리

### 1. 인증 (Auth)
사용자 계정 관리 및 인증

- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인 (JWT 발급)
- `GET /api/auth/me` - 내 정보 조회

### 2. 세션 (Session)
게임 세션 관리

- `GET /api/session/templates` - 사용 가능한 템플릿 목록
- `GET /api/session/list` - 모든 세션 조회
- `POST /api/session/create` - 세션 생성
- `GET /api/session/:id` - 세션 상세 조회
- `PUT /api/session/:id` - 세션 설정 수정
- `POST /api/session/:id/start` - 세션 시작
- `POST /api/session/:id/end` - 세션 종료

### 3. 장수 (General)
장수 관리 및 행동

- `GET /api/general/list` - 장수 목록 조회
- `GET /api/general/:id` - 장수 상세 조회
- `POST /api/general/build-nation-candidate` - 국가 설립 후보 등록
- `POST /api/general/die-on-prestart` - 사망 처리
- `POST /api/general/drop-item` - 아이템 버리기
- `POST /api/general/join` - 국가 가입
- `GET /api/general/command-table` - 사용 가능한 명령 목록
- `GET /api/general/front-info` - 전선 정보
- `GET /api/general/log` - 장수 활동 로그

### 4. 국가 (Nation)
국가 관리 및 외교

- `GET /api/nation/list` - 국가 목록 조회
- `GET /api/nation/:id` - 국가 상세 조회
- `POST /api/nation/create` - 국가 설립
- `PUT /api/nation/:id` - 국가 정보 수정
- `DELETE /api/nation/:id` - 국가 해체
- `POST /api/nation/:id/diplomacy` - 외교 관계 설정
- `GET /api/nation/:id/generals` - 국가 소속 장수
- `GET /api/nation/:id/cities` - 국가 소속 도시
- `POST /api/nation/:id/policy` - 국가 정책 변경

### 5. 명령 (Command)
턴제 명령 시스템

- `GET /api/command/list` - 제출한 명령 목록
- `GET /api/command/get-reserved-command` - 예약 명령 조회
- `POST /api/command/push-command` - 명령 제출
- `DELETE /api/command/:id` - 명령 취소
- `GET /api/command/history` - 명령 이력

### 6. 게임 (Game)
게임 진행 및 턴 관리

- `GET /api/game/status` - 게임 상태 조회
- `POST /api/game/process-turn` - 턴 처리
- `GET /api/game/turn-info` - 현재 턴 정보
- `POST /api/game/pause` - 게임 일시정지
- `POST /api/game/resume` - 게임 재개

### 7. 전투 (Battle)
전투 시스템

- `GET /api/battle/list` - 진행 중인 전투 목록
- `GET /api/battle/:id` - 전투 상세 조회
- `POST /api/battle/start` - 전투 시작
- `POST /api/battle/:id/action` - 전투 행동
- `GET /api/battle/:id/result` - 전투 결과

### 8. 경매 (Auction)
아이템 및 자원 경매

- `GET /api/auction/list` - 진행 중인 경매 목록
- `POST /api/auction/create` - 경매 등록
- `POST /api/auction/:id/bid` - 입찰
- `GET /api/auction/:id` - 경매 상세
- `DELETE /api/auction/:id` - 경매 취소

### 9. 베팅 (Betting)
전투 결과 베팅

- `GET /api/betting/list` - 베팅 가능한 전투
- `POST /api/betting/place` - 베팅하기
- `GET /api/betting/:id` - 베팅 정보 조회

### 10. 메시지 (Message)
플레이어 간 메시징

- `GET /api/message/inbox` - 받은 메시지함
- `GET /api/message/sent` - 보낸 메시지함
- `POST /api/message/send` - 메시지 전송
- `PUT /api/message/:id/read` - 읽음 처리
- `DELETE /api/message/:id` - 메시지 삭제

### 11. 투표 (Vote)
국가 내 투표 시스템

- `GET /api/vote/list` - 진행 중인 투표
- `POST /api/vote/create` - 투표 생성
- `POST /api/vote/:id/cast` - 투표하기
- `GET /api/vote/:id/result` - 투표 결과

## 📊 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {
    // 응답 데이터
  },
  "message": "작업이 성공적으로 완료되었습니다"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": "에러 메시지",
  "code": "ERROR_CODE"
}
```

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|-----|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 (유효성 검증 실패) |
| 401 | Unauthorized | 인증 실패 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 409 | Conflict | 리소스 충돌 (중복 등) |
| 500 | Internal Server Error | 서버 내부 오류 |

## 🔄 페이지네이션

목록 조회 API는 페이지네이션을 지원합니다.

### 요청 파라미터
```
GET /api/general/list?page=1&limit=20&sort=name&order=asc
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| page | 페이지 번호 (1부터 시작) | 1 |
| limit | 페이지당 항목 수 | 20 |
| sort | 정렬 기준 필드 | createdAt |
| order | 정렬 순서 (asc/desc) | desc |

### 응답
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 98,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🎯 사용 예제

### 1. 회원가입 & 로그인

```bash
# 1. 회원가입
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "player1", "password": "password123"}'

# 2. 로그인
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "player1", "password": "password123"}'
```

### 2. 장수 조회

```bash
curl -X GET http://localhost:8080/api/general/list \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. 명령 제출

```bash
curl -X POST http://localhost:8080/api/command/push-command \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "generalId": "507f1f77bcf86cd799439011",
    "commandType": "TRAIN",
    "params": {
      "type": "soldier",
      "amount": 100
    }
  }'
```

## 🛠️ 개발 도구

### Postman Collection
```bash
# OpenAPI 스펙을 Postman으로 import
http://localhost:8080/api-docs.json
```

### cURL 스크립트
```bash
# 편의를 위한 cURL 스크립트
./scripts/test-api.sh
```

## 📈 성능

- **평균 응답 시간**: < 50ms
- **동시 접속**: 1000+ connections
- **캐싱**: Redis L1/L2 캐싱으로 최적화
- **데이터베이스**: MongoDB 인덱싱 최적화

## 🔧 문제 해결

### 401 Unauthorized
- JWT 토큰이 만료되었거나 유효하지 않음
- 다시 로그인하여 새 토큰 받기

### 400 Bad Request
- 필수 파라미터 누락 확인
- 데이터 타입 확인
- Swagger UI에서 스키마 확인

### 500 Internal Server Error
- 서버 로그 확인
- MongoDB/Redis 연결 상태 확인

## 📝 변경 이력

### v1.0.0 (2025-11-01)
- ✅ 초기 API 릴리스
- ✅ 모든 엔드포인트 Swagger 문서화
- ✅ JWT 인증 구현
- ✅ 108개 엔드포인트 완성

## 🤝 기여

API 개선 사항이나 버그는 GitHub Issues에 보고해 주세요.

---

**총 엔드포인트**: 108개  
**문서화 완료**: 100%  
**인증 방식**: JWT Bearer Token  
**포트**: 8080  
**Swagger UI**: http://localhost:8080/api-docs
