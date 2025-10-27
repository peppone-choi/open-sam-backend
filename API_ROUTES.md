# API Routes

## 전체 엔드포인트 (33개 도메인)

### Admin (관리자)

- `GET    /api/admin/config` - 게임 설정 조회
- `PUT    /api/admin/config/unit-advantage` - 병종 상성 수정
- `PUT    /api/admin/config/units` - 병종 정보 수정
- `PUT    /api/admin/config/balance` - 게임 밸런스 수정
- `PUT    /api/admin/config/turn` - 턴 설정 수정
- `PUT    /api/admin/config/exp` - 경험치 설정 수정
- `CRUD   /api/admin/generals` - 장수 관리
- `CRUD   /api/admin/cities` - 도시 관리
- `CRUD   /api/admin/nations` - 국가 관리
- `GET    /api/admin/system/status` - 시스템 상태
- `GET    /api/admin/system/stats` - DB 통계

### Core Domains (핵심 도메인)

#### General (장수)
- `GET    /api/generals` - 장수 목록
- `GET    /api/generals/:id` - 장수 상세
- `POST   /api/generals` - 장수 생성
- `PUT    /api/generals/:id` - 장수 수정
- `DELETE /api/generals/:id` - 장수 삭제

#### City (도시)
- `GET    /api/cities` - 도시 목록
- `GET    /api/cities/:id` - 도시 상세
- `POST   /api/cities` - 도시 생성
- `PUT    /api/cities/:id` - 도시 수정
- `DELETE /api/cities/:id` - 도시 삭제

#### Nation (국가)
- `GET    /api/nations` - 국가 목록
- `GET    /api/nations/:id` - 국가 상세
- `POST   /api/nations` - 국가 생성
- `PUT    /api/nations/:id` - 국가 수정
- `DELETE /api/nations/:id` - 국가 삭제

#### Command (명령)
- `GET    /api/commands` - 명령 목록
- `GET    /api/commands/:id` - 명령 상세
- `POST   /api/commands` - 명령 제출
- `PUT    /api/commands/:id` - 명령 수정
- `DELETE /api/commands/:id` - 명령 삭제

#### Game Session (게임 세션)
- `GET    /api/game-sessions` - 세션 목록
- `GET    /api/game-sessions/:id` - 세션 상세
- `POST   /api/game-sessions` - 세션 생성
- `PUT    /api/game-sessions/:id` - 세션 수정
- `DELETE /api/game-sessions/:id` - 세션 삭제

### General Related (장수 관련)

#### General Turn (장수 턴)
- `GET    /api/general-turns` - 장수 턴 목록
- `GET    /api/general-turns/:id` - 장수 턴 상세
- `POST   /api/general-turns` - 장수 턴 생성
- `PUT    /api/general-turns/:id` - 장수 턴 수정
- `DELETE /api/general-turns/:id` - 장수 턴 삭제

#### General Access Log (장수 접속 기록)
- `GET    /api/general-access-logs` - 접속 기록 목록
- `GET    /api/general-access-logs/:id` - 접속 기록 상세
- `POST   /api/general-access-logs` - 접속 기록 생성
- `PUT    /api/general-access-logs/:id` - 접속 기록 수정
- `DELETE /api/general-access-logs/:id` - 접속 기록 삭제

#### General Record (장수 전적)
- `GET    /api/general-records` - 장수 전적 목록
- `GET    /api/general-records/:id` - 장수 전적 상세
- `POST   /api/general-records` - 장수 전적 생성
- `PUT    /api/general-records/:id` - 장수 전적 수정
- `DELETE /api/general-records/:id` - 장수 전적 삭제

### Nation Related (국가 관련)

#### Nation Turn (국가 턴)
- `GET    /api/nation-turns` - 국가 턴 목록
- `GET    /api/nation-turns/:id` - 국가 턴 상세
- `POST   /api/nation-turns` - 국가 턴 생성
- `PUT    /api/nation-turns/:id` - 국가 턴 수정
- `DELETE /api/nation-turns/:id` - 국가 턴 삭제

#### Nation Env (국가 환경)
- `GET    /api/nation-envs` - 국가 환경 목록
- `GET    /api/nation-envs/:id` - 국가 환경 상세
- `POST   /api/nation-envs` - 국가 환경 생성
- `PUT    /api/nation-envs/:id` - 국가 환경 수정
- `DELETE /api/nation-envs/:id` - 국가 환경 삭제

### Military (군사)

#### Troop (부대)
- `GET    /api/troops` - 부대 목록
- `GET    /api/troops/:id` - 부대 상세
- `POST   /api/troops` - 부대 생성
- `PUT    /api/troops/:id` - 부대 수정
- `DELETE /api/troops/:id` - 부대 삭제

#### Battle (전투)
- `GET    /api/battles` - 전투 목록
- `GET    /api/battles/:id` - 전투 상세
- `POST   /api/battles` - 전투 생성
- `PUT    /api/battles/:id` - 전투 수정
- `DELETE /api/battles/:id` - 전투 삭제

#### Battlefield Tile (전장 타일)
- `GET    /api/battlefield-tiles` - 전장 타일 목록
- `GET    /api/battlefield-tiles/:id` - 전장 타일 상세
- `POST   /api/battlefield-tiles` - 전장 타일 생성
- `PUT    /api/battlefield-tiles/:id` - 전장 타일 수정
- `DELETE /api/battlefield-tiles/:id` - 전장 타일 삭제

#### Item (아이템)
- `GET    /api/items` - 아이템 목록
- `GET    /api/items/:id` - 아이템 상세
- `POST   /api/items` - 아이템 생성
- `PUT    /api/items/:id` - 아이템 수정
- `DELETE /api/items/:id` - 아이템 삭제

### Communication (커뮤니케이션)

#### Message (메시지)
- `GET    /api/messages` - 메시지 목록
- `GET    /api/messages/:id` - 메시지 상세
- `POST   /api/messages` - 메시지 발송
- `PUT    /api/messages/:id` - 메시지 수정
- `DELETE /api/messages/:id` - 메시지 삭제

#### Board (게시판)
- `GET    /api/boards` - 게시판 목록
- `GET    /api/boards/:id` - 게시판 상세
- `POST   /api/boards` - 게시판 생성
- `PUT    /api/boards/:id` - 게시판 수정
- `DELETE /api/boards/:id` - 게시판 삭제

#### Comment (댓글)
- `GET    /api/comments` - 댓글 목록
- `GET    /api/comments/:id` - 댓글 상세
- `POST   /api/comments` - 댓글 작성
- `PUT    /api/comments/:id` - 댓글 수정
- `DELETE /api/comments/:id` - 댓글 삭제

### History (역사/기록)

#### World History (세계 역사)
- `GET    /api/world-histories` - 세계 역사 목록
- `GET    /api/world-histories/:id` - 세계 역사 상세
- `POST   /api/world-histories` - 세계 역사 생성
- `PUT    /api/world-histories/:id` - 세계 역사 수정
- `DELETE /api/world-histories/:id` - 세계 역사 삭제

#### NG History (NG 역사)
- `GET    /api/ng-histories` - NG 역사 목록
- `GET    /api/ng-histories/:id` - NG 역사 상세
- `POST   /api/ng-histories` - NG 역사 생성
- `PUT    /api/ng-histories/:id` - NG 역사 수정
- `DELETE /api/ng-histories/:id` - NG 역사 삭제

### Game System (게임 시스템)

#### Event (이벤트)
- `GET    /api/events` - 이벤트 목록
- `GET    /api/events/:id` - 이벤트 상세
- `POST   /api/events` - 이벤트 생성
- `PUT    /api/events/:id` - 이벤트 수정
- `DELETE /api/events/:id` - 이벤트 삭제

#### Plock (플록)
- `GET    /api/plocks` - 플록 목록
- `GET    /api/plocks/:id` - 플록 상세
- `POST   /api/plocks` - 플록 생성
- `PUT    /api/plocks/:id` - 플록 수정
- `DELETE /api/plocks/:id` - 플록 삭제

#### Reserved Open (예약 오픈)
- `GET    /api/reserved-opens` - 예약 오픈 목록
- `GET    /api/reserved-opens/:id` - 예약 오픈 상세
- `POST   /api/reserved-opens` - 예약 오픈 생성
- `PUT    /api/reserved-opens/:id` - 예약 오픈 수정
- `DELETE /api/reserved-opens/:id` - 예약 오픈 삭제

#### Storage (저장소)
- `GET    /api/storages` - 저장소 목록
- `GET    /api/storages/:id` - 저장소 상세
- `POST   /api/storages` - 저장소 생성
- `PUT    /api/storages/:id` - 저장소 수정
- `DELETE /api/storages/:id` - 저장소 삭제

#### Rank Data (랭킹 데이터)
- `GET    /api/rank-data` - 랭킹 목록
- `GET    /api/rank-data/:id` - 랭킹 상세
- `POST   /api/rank-data` - 랭킹 생성
- `PUT    /api/rank-data/:id` - 랭킹 수정
- `DELETE /api/rank-data/:id` - 랭킹 삭제

### Selection (선택)

#### Select NPC Token (NPC 토큰 선택)
- `GET    /api/select-npc-tokens` - NPC 토큰 목록
- `GET    /api/select-npc-tokens/:id` - NPC 토큰 상세
- `POST   /api/select-npc-tokens` - NPC 토큰 생성
- `PUT    /api/select-npc-tokens/:id` - NPC 토큰 수정
- `DELETE /api/select-npc-tokens/:id` - NPC 토큰 삭제

#### Select Pool (선택 풀)
- `GET    /api/select-pools` - 선택 풀 목록
- `GET    /api/select-pools/:id` - 선택 풀 상세
- `POST   /api/select-pools` - 선택 풀 생성
- `PUT    /api/select-pools/:id` - 선택 풀 수정
- `DELETE /api/select-pools/:id` - 선택 풀 삭제

### User (사용자)

#### User Record (사용자 기록)
- `GET    /api/user-records` - 사용자 기록 목록
- `GET    /api/user-records/:id` - 사용자 기록 상세
- `POST   /api/user-records` - 사용자 기록 생성
- `PUT    /api/user-records/:id` - 사용자 기록 수정
- `DELETE /api/user-records/:id` - 사용자 기록 삭제

### Events (이벤트)

#### NG Betting (NG 베팅)
- `GET    /api/ng-bettings` - 베팅 목록
- `GET    /api/ng-bettings/:id` - 베팅 상세
- `POST   /api/ng-bettings` - 베팅 생성
- `PUT    /api/ng-bettings/:id` - 베팅 수정
- `DELETE /api/ng-bettings/:id` - 베팅 삭제

#### Vote (투표)
- `GET    /api/votes` - 투표 목록
- `GET    /api/votes/:id` - 투표 상세
- `POST   /api/votes` - 투표 생성
- `PUT    /api/votes/:id` - 투표 수정
- `DELETE /api/votes/:id` - 투표 삭제

#### Vote Comment (투표 댓글)
- `GET    /api/vote-comments` - 투표 댓글 목록
- `GET    /api/vote-comments/:id` - 투표 댓글 상세
- `POST   /api/vote-comments` - 투표 댓글 작성
- `PUT    /api/vote-comments/:id` - 투표 댓글 수정
- `DELETE /api/vote-comments/:id` - 투표 댓글 삭제

#### NG Auction (NG 경매)
- `GET    /api/ng-auctions` - 경매 목록
- `GET    /api/ng-auctions/:id` - 경매 상세
- `POST   /api/ng-auctions` - 경매 생성
- `PUT    /api/ng-auctions/:id` - 경매 수정
- `DELETE /api/ng-auctions/:id` - 경매 삭제

#### NG Auction Bid (NG 경매 입찰)
- `GET    /api/ng-auction-bids` - 입찰 목록
- `GET    /api/ng-auction-bids/:id` - 입찰 상세
- `POST   /api/ng-auction-bids` - 입찰 생성
- `PUT    /api/ng-auction-bids/:id` - 입찰 수정
- `DELETE /api/ng-auction-bids/:id` - 입찰 삭제

## 통계

- **총 도메인**: 33개 (Admin 포함)
- **총 엔드포인트**: 165개+ (CRUD 5개 × 32 + Admin 11개)
- **카테고리**: 10개

## 사용 예시

### 장수 목록 조회
```bash
curl http://localhost:3000/api/generals
```

### 도시 상세 조회
```bash
curl http://localhost:3000/api/cities/city-123
```

### 명령 제출
```bash
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "generalId": "gen-123",
    "type": "TRAIN",
    "payload": {}
  }'
```

### 게임 설정 수정 (Admin)
```bash
curl -X PUT http://localhost:3000/api/admin/config/balance \
  -H "X-Admin-Id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{
    "domestic": {
      "agriculture": 1.2
    }
  }'
```
