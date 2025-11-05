# 프론트엔드-백엔드 API 불일치 리포트

**생성 날짜:** 2024-12-19  
**검증 범위:** 프론트엔드 API 호출 vs 백엔드 라우트 정의

## 요약

총 **불일치 항목: 15개** 발견

## 주요 불일치 항목

### 1. 인증 관련 (2개)

#### ❌ `/api/login/by-token` POST
- **프론트엔드:** `sammo.ts:197` - POST 요청
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/login/req-nonce` POST
- **프론트엔드:** `sammo.ts:207` - POST 요청
- **백엔드:** 라우트 없음
- **상태:** 누락

### 2. 명령 관련 (2개)

#### ⚠️ `/api/command/reserve` POST
- **프론트엔드:** `sammo.ts:261` - `/api/command/reserve`
- **백엔드:** `command.routes.ts:469` - `/api/command/reserve-command`
- **상태:** 경로 불일치
- **해결:** 프론트엔드 수정 필요 또는 백엔드에 별칭 추가

#### ⚠️ `/api/command/push` POST
- **프론트엔드:** `sammo.ts:275` - `/api/command/push`
- **백엔드:** `command.routes.ts:193` - `/api/command/push-command`
- **상태:** 경로 불일치
- **해결:** 프론트엔드 수정 필요 또는 백엔드에 별칭 추가

### 3. 국가 관련 (1개)

#### ⚠️ `/api/nation/info` POST
- **프론트엔드:** `sammo.ts:286` - POST `/api/nation/info`
- **백엔드:** `nation.routes.ts:695` - GET `/api/nation/get-nation-info`
- **상태:** 메서드 및 경로 불일치
- **해결:** 프론트엔드 수정 필요

### 4. 메시지 관련 (1개)

#### ⚠️ `/api/message/get-recent` POST
- **프론트엔드:** `sammo.ts:308` - POST `/api/message/get-recent`
- **백엔드:** `message.routes.ts:182` - GET `/api/message/get-recent-message`
- **상태:** 메서드 및 경로 불일치
- **해결:** 프론트엔드 수정 필요

### 5. Gateway 관련 (5개)

#### ❌ `/api/gateway/get-user-info` POST
- **프론트엔드:** `sammo.ts:455` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/gateway/get-server-status` POST
- **프론트엔드:** `sammo.ts:470` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/gateway/logout` POST
- **프론트엔드:** `sammo.ts:479` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/gateway/change-password` POST
- **프론트엔드:** `sammo.ts:492` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/gateway/delete-me` POST
- **프론트엔드:** `sammo.ts:505` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

### 6. 외교 관련 (3개)

#### ❌ `/api/diplomacy/get-letter` POST
- **프론트엔드:** `sammo.ts:640` - POST
- **백엔드:** `legacy/diplomacy.ts`에만 존재 (확인 필요)
- **상태:** 구현 누락 가능성

#### ❌ `/api/diplomacy/send-letter` POST
- **프론트엔드:** `sammo.ts:654` - POST
- **백엔드:** `legacy/diplomacy.ts`에만 존재 (확인 필요)
- **상태:** 구현 누락 가능성

#### ❌ `/api/diplomacy/respond-letter` POST
- **프론트엔드:** `sammo.ts:667` - POST
- **백엔드:** `legacy/diplomacy.ts`에만 존재 (확인 필요)
- **상태:** 구현 누락 가능성

### 7. 아카이브 관련 (7개)

#### ❌ `/api/archive/*` 전체
- **프론트엔드:** `sammo.ts:838-917` - 7개 API
  - `/api/archive/best-general`
  - `/api/archive/emperior`
  - `/api/archive/emperior-detail`
  - `/api/archive/hall-of-fame`
  - `/api/archive/gen-list`
  - `/api/archive/kingdom-list`
  - `/api/archive/npc-list`
  - `/api/archive/traffic`
- **백엔드:** 라우트 없음
- **상태:** 전체 누락

### 8. NPC 관련 (2개)

#### ❌ `/api/npc/get-control` POST
- **프론트엔드:** `sammo.ts:1014` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

#### ❌ `/api/npc/set-control` POST
- **프론트엔드:** `sammo.ts:1025` - POST
- **백엔드:** 라우트 없음
- **상태:** 누락

### 9. 기타 누락된 API들

#### ❌ 게임 관련
- `/api/game/basic-info` POST
- `/api/game/map` POST
- `/api/game/city-list` POST
- `/api/game/general-list` POST
- `/api/game/select-npc` POST
- `/api/game/select-picked-general` POST
- `/api/game/set-my-setting` POST
- `/api/game/vacation` POST
- `/api/game/current-city` POST
- `/api/game/my-city-info` POST
- `/api/game/my-gen-info` POST
- `/api/game/history` POST

**참고:** `game.routes.ts`에 다른 엔드포인트들이 있지만, 프론트엔드가 호출하는 경로와 일치하는지 확인 필요

#### ❌ 관리자 관련
- `/api/admin/diplomacy` POST
- `/api/admin/game-info` POST
- `/api/admin/update-game` POST
- `/api/admin/info` POST
- `/api/admin/general` POST
- `/api/admin/member` POST
- `/api/admin/time-control` POST
- `/api/admin/update-time-control` POST
- `/api/admin/force-rehall` POST

**참고:** `admin.router.ts`에 구현되어 있을 수 있음 (확인 필요)

#### ❌ 기타
- `/api/chief/center` POST
- `/api/join/get-nations` POST
- `/api/join/create-general` POST
- `/api/battle/simulate` POST
- `/api/battle/center` POST
- `/api/battle/detail` POST
- `/api/info/*` (4개)
- `/api/tournament/*` (3개)
- `/api/world/info` POST
- `/api/processing/*` (2개)
- `/api/install/*` (5개)

## 해결 방안

### 우선순위 1: 즉시 수정 필요 (경로 불일치)

1. **Command API 경로 통일**
   - 옵션 A: 백엔드에 별칭 추가
     ```typescript
     router.post('/reserve', ...); // 별칭
     router.post('/push', ...); // 별칭
     ```
   - 옵션 B: 프론트엔드 수정
     ```typescript
     // /api/command/reserve → /api/command/reserve-command
     // /api/command/push → /api/command/push-command
     ```

2. **Nation API 경로/메서드 통일**
   - 프론트엔드: `POST /api/nation/info`
   - 백엔드: `GET /api/nation/get-nation-info`
   - 해결: 프론트엔드를 GET `/api/nation/get-nation-info로 변경

3. **Message API 경로/메서드 통일**
   - 프론트엔드: `POST /api/message/get-recent`
   - 백엔드: `GET /api/message/get-recent-message`
   - 해결: 프론트엔드를 GET `/api/message/get-recent-message`로 변경

### 우선순위 2: 누락된 API 구현

1. **Gateway API** (5개)
   - 사용자 정보, 서버 상태, 로그아웃, 비밀번호 변경, 계정 삭제
   - 구현 위치: `src/routes/gateway.routes.ts` 생성

2. **Login API** (2개)
   - `/api/login/by-token` - 토큰 기반 로그인
   - `/api/login/req-nonce` - Nonce 요청
   - 구현 위치: `src/routes/auth.routes.ts`에 추가

3. **Archive API** (7개)
   - 명예의 전당, 역사 기록 등
   - 구현 위치: `src/routes/archive.routes.ts` 생성

4. **NPC Control API** (2개)
   - NPC 제어 설정
   - 구현 위치: `src/routes/npc.routes.ts` 생성

### 우선순위 3: 확인 필요 (구현되어 있을 수 있음)

1. **Game API** - `game.routes.ts` 확인
2. **Admin API** - `admin.router.ts` 확인
3. **Diplomacy API** - `legacy/diplomacy.ts` 확인 후 마이그레이션

## 권장 조치

### 즉시 조치
1. ✅ Command API 별칭 추가 (백엔드)
2. ✅ Nation/Message API 경로 수정 (프론트엔드)

### 단기 조치 (1주일 내)
1. Gateway API 구현
2. Login API 구현
3. Archive API 구현 계획 수립

### 중기 조치 (1개월 내)
1. NPC Control API 구현
2. Game API 경로 확인 및 통일
3. Admin API 확인 및 보완

## 확인된 정상 매칭 API

다음 API들은 정상적으로 매칭됩니다:
- ✅ `/api/auth/login` POST
- ✅ `/api/auth/register` POST
- ✅ `/api/general/get-front-info` GET
- ✅ `/api/global/get-map` GET
- ✅ `/api/global/get-const` GET
- ✅ `/api/global/get-nation-list` GET
- ✅ `/api/nation/set-notice` POST
- ✅ `/api/message/send` POST
- ✅ `/api/auction/*` (일부)
- ✅ `/api/betting/*` (일부)
- ✅ `/api/vote/*` (일부)

## 참고

- API_MAPPING_REPORT.md는 이전 검증 결과이며, 일부 API가 누락되거나 경로가 변경되었을 수 있습니다.
- 실제 사용 중인 API만 확인했으며, 미사용 API는 제외했습니다.




