# API 일원화 분석 보고서

## 프로젝트 개요

Open SAM 프로젝트는 현재 **이원화된 백엔드 시스템**을 운영하고 있습니다:
1. **레거시 시스템** (PHP 기반) - `/core` 디렉토리
2. **신규 백엔드** (Node.js + TypeScript + Express) - `/open-sam-backend` 디렉토리

---

## 1. 백엔드 API 구조 분석 (`/open-sam-backend`)

### 1.1 기술 스택
- **언어**: TypeScript
- **프레임워크**: Express.js
- **데이터베이스**: MongoDB (Mongoose ORM)
- **캐시**: Redis
- **인증**: JWT
- **실시간 통신**: Socket.IO

### 1.2 데이터베이스 연결 방식
**파일**: `/open-sam-backend/src/config/db.ts`

```typescript
// MongoDB 연결
MONGODB_URI=mongodb://localhost:27017/sangokushi

// DB 헬퍼 클래스
export class DB {
  async getGeneral(generalId: number, sessionId?: string)
  async getCity(cityId: number, sessionId: string)
  async getNation(nationId: number, sessionId: string)
  // ... CRUD 메서드
}
```

### 1.3 API 모듈 구조

#### 주요 디렉토리
```
/open-sam-backend/src/api/
├── admin/          # 관리자 기능
├── battle/         # 전투 시스템
├── command/        # 명령 시스템
├── game-session/   # 게임 세션 관리
├── unified/        # 통합 엔티티 API
└── v2/            # API v2 (신규)
```

### 1.4 백엔드 API 엔드포인트 목록

#### 🔧 Admin API (`/api/admin/`)
| 엔드포인트 | 메서드 | 설명 | 권한 |
|-----------|--------|------|------|
| `/config` | GET | 게임 설정 조회 | MANAGE_CONFIG |
| `/config/unit-advantage` | PUT | 병종 상성 업데이트 | MANAGE_CONFIG |
| `/config/units` | PUT | 병종 정보 업데이트 | MANAGE_CONFIG |
| `/config/balance` | PUT | 게임 밸런스 업데이트 | MANAGE_CONFIG |
| `/config/turn` | PUT | 턴 설정 업데이트 | MANAGE_CONFIG |
| `/config/exp` | PUT | 경험치 설정 업데이트 | MANAGE_CONFIG |
| `/generals` | GET | 장수 목록 조회 | MANAGE_GENERALS |
| `/generals/:id` | GET/PUT/DELETE | 장수 CRUD | MANAGE_GENERALS |
| `/cities` | GET | 도시 목록 조회 | MANAGE_CITIES |
| `/cities/:id` | PUT | 도시 정보 수정 | MANAGE_CITIES |
| `/nations` | GET | 세력 목록 조회 | MANAGE_NATIONS |
| `/nations/:id` | PUT | 세력 정보 수정 | MANAGE_NATIONS |
| `/system/status` | GET | 시스템 상태 확인 | ADMIN |
| `/system/stats` | GET | DB 통계 조회 | ADMIN |

#### ⚔️ Battle API (`/api/battle/`)
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/` | GET | 전투 목록 조회 |
| `/:id` | GET | 전투 상세 조회 |
| `/` | POST | 전투 생성 |
| `/:id` | PUT | 전투 정보 수정 |
| `/:id` | DELETE | 전투 삭제 |

#### 📋 Command API (`/api/command/`)
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/` | GET | 명령 목록 조회 |
| `/:id` | GET | 명령 상세 조회 |
| `/commander/:commanderId` | GET | 지휘관별 명령 조회 |
| `/` | POST | 명령 생성 |
| `/submit` | POST | 명령 제출 |
| `/:id` | PUT | 명령 수정 |
| `/:id` | DELETE | 명령 취소 |

#### 🎮 Game Session API (`/api/game-session/`)
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/` | GET | 세션 목록 |
| `/:id` | GET | 세션 상세 |
| `/` | POST | 세션 생성 |
| `/:id` | PUT | 세션 수정 |

#### 🔄 Unified Entity API (`/api/unified/entities/`)
통합 엔티티 시스템 - ECS(Entity Component System) 패턴 기반

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/:role` | GET | 역할별 엔티티 목록 |
| `/:role` | POST | 엔티티 생성 |
| `/:role/:id` | GET | 엔티티 조회 |
| `/:role/:id` | PATCH | 엔티티 수정 |
| `/:role/:id` | DELETE | 엔티티 삭제 |
| `/:role/:id/attributes` | GET/PATCH | 속성 관리 |
| `/:role/:id/resources` | GET/PATCH | 자원 관리 |
| `/:role/:id/slots` | GET/PATCH | 슬롯 관리 |
| `/:role/:id/refs` | GET/PATCH | 참조 관리 |
| `/:role/:id/systems/:systemId` | GET | 시스템 상태 조회 |
| `/:role/:id/systems/:systemId/commands/:command` | POST | 시스템 명령 실행 |
| `/edges` | GET | 엔티티 관계 조회 |
| `/edges` | POST | 관계 생성 |
| `/edges/:id` | DELETE | 관계 삭제 |

---

## 2. 레거시 API 구조 분석 (`/core`)

### 2.1 기술 스택
- **언어**: PHP 7.4+
- **프레임워크**: 없음 (순수 PHP)
- **데이터베이스**: MySQL (MeekroDB, Eloquent ORM)
- **라우팅**: 커스텀 API 라우터

### 2.2 데이터베이스 연결 방식
**파일**: `/core/f_config/config.php`, `/core/f_install/templates/RootDB.orig.php`

```php
class RootDB {
    private static $host = '_tK_host_';
    private static $user = '_tK_user_';
    private static $password = '_tK_password_';
    private static $dbName = '_tK_dbName_';
    private static $port = _tK_port_;
    
    // MySQL 연결 (MeekroDB 사용)
    public static function db() {
        return new \MeekroDB(
            self::$host, 
            self::$user, 
            self::$password, 
            self::$dbName, 
            self::$port, 
            'utf8mb4'
        );
    }
    
    // Eloquent ORM 지원
    public static function illuminate(): Capsule {
        // Laravel Eloquent 사용
    }
}
```

### 2.3 API 라우팅 구조
**파일**: `/core/api.php`

```php
// URL 패턴: /api.php?path=Category/ActionName
APIHelper::launch(
    dirname(__FILE__), 
    $_GET['path']??'', 
    $eParams, 
    true
);

// 예시: /api.php?path=General/GetFrontInfo
// 클래스: \sammo\API\General\GetFrontInfo
```

### 2.4 레거시 API 카테고리 (총 83개 엔드포인트)

#### 📁 API 디렉토리 구조
```
/core/hwe/sammo/API/
├── Admin/          # 관리자 기능 (Login 등)
├── Auction/        # 경매 시스템 (9개)
├── Betting/        # 베팅 시스템 (3개)
├── Command/        # 명령 시스템 (5개)
├── General/        # 장수 관련 (8개)
├── Global/         # 전역 정보 (9개)
├── InheritAction/  # 유산 관리 (8개)
├── Message/        # 메시지 시스템 (7개)
├── Misc/           # 기타 (1개 - 이미지 업로드)
├── Nation/         # 세력 관리 (9개)
├── NationCommand/  # 세력 명령 (5개)
├── Troop/          # 부대 시스템 (5개)
└── Vote/           # 투표 시스템 (5개)
```

### 2.5 레거시 API 엔드포인트 상세 목록

#### 🏪 Auction API (9개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `BidBuyRiceAuction.php` | `/Auction/BidBuyRiceAuction` | 쌀 구매 경매 입찰 |
| `BidSellRiceAuction.php` | `/Auction/BidSellRiceAuction` | 쌀 판매 경매 입찰 |
| `BidUniqueAuction.php` | `/Auction/BidUniqueAuction` | 유니크 아이템 경매 입찰 |
| `GetActiveResourceAuctionList.php` | `/Auction/GetActiveResourceAuctionList` | 활성 자원 경매 목록 |
| `GetUniqueItemAuctionDetail.php` | `/Auction/GetUniqueItemAuctionDetail` | 유니크 아이템 경매 상세 |
| `GetUniqueItemAuctionList.php` | `/Auction/GetUniqueItemAuctionList` | 유니크 아이템 경매 목록 |
| `OpenBuyRiceAuction.php` | `/Auction/OpenBuyRiceAuction` | 쌀 구매 경매 열기 |
| `OpenSellRiceAuction.php` | `/Auction/OpenSellRiceAuction` | 쌀 판매 경매 열기 |
| `OpenUniqueAuction.php` | `/Auction/OpenUniqueAuction` | 유니크 아이템 경매 열기 |

#### 🎲 Betting API (3개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `Bet.php` | `/Betting/Bet` | 베팅하기 |
| `GetBettingDetail.php` | `/Betting/GetBettingDetail` | 베팅 상세 조회 |
| `GetBettingList.php` | `/Betting/GetBettingList` | 베팅 목록 조회 |

#### 📋 Command API (5개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `GetReservedCommand.php` | `/Command/GetReservedCommand` | 예약된 명령 조회 |
| `PushCommand.php` | `/Command/PushCommand` | 명령 밀기 (순서 조정) |
| `RepeatCommand.php` | `/Command/RepeatCommand` | 명령 반복 |
| `ReserveBulkCommand.php` | `/Command/ReserveBulkCommand` | 일괄 명령 예약 |
| `ReserveCommand.php` | `/Command/ReserveCommand` | 명령 예약 |

#### 🎖️ General API (8개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `BuildNationCandidate.php` | `/General/BuildNationCandidate` | 건국 후보 등록 |
| `DieOnPrestart.php` | `/General/DieOnPrestart` | 게임 시작 전 사망 |
| `DropItem.php` | `/General/DropItem` | 아이템 버리기 |
| `GetCommandTable.php` | `/General/GetCommandTable` | 명령표 조회 |
| `GetFrontInfo.php` | `/General/GetFrontInfo` | **메인 페이지 정보** (핵심) |
| `GetGeneralLog.php` | `/General/GetGeneralLog` | 장수 로그 조회 |
| `InstantRetreat.php` | `/General/InstantRetreat` | 즉시 후퇴 |
| `Join.php` | `/General/Join` | 게임 참가 |

#### 🌍 Global API (9개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `ExecuteEngine.php` | `/Global/ExecuteEngine` | 게임 엔진 실행 (턴 진행) |
| `GeneralList.php` | `/Global/GeneralList` | 장수 목록 조회 |
| `GeneralListWithToken.php` | `/Global/GeneralListWithToken` | 토큰 기반 장수 목록 |
| `GetCachedMap.php` | `/Global/GetCachedMap` | 캐시된 맵 정보 |
| `GetConst.php` | `/Global/GetConst` | 게임 상수 조회 |
| `GetCurrentHistory.php` | `/Global/GetCurrentHistory` | 현재 역사 조회 |
| `GetDiplomacy.php` | `/Global/GetDiplomacy` | 외교 정보 조회 |
| `GetGlobalMenu.php` | `/Global/GetGlobalMenu` | 전역 메뉴 정보 |
| `GetHistory.php` | `/Global/GetHistory` | 역사 기록 조회 |
| `GetMap.php` | `/Global/GetMap` | 맵 정보 조회 |

#### 💰 InheritAction API (8개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `BuyHiddenBuff.php` | `/InheritAction/BuyHiddenBuff` | 히든 버프 구매 |
| `BuyRandomUnique.php` | `/InheritAction/BuyRandomUnique` | 랜덤 유니크 구매 |
| `CheckOwner.php` | `/InheritAction/CheckOwner` | 소유자 확인 |
| `GetMoreLog.php` | `/InheritAction/GetMoreLog` | 추가 로그 조회 |
| `ResetSpecialWar.php` | `/InheritAction/ResetSpecialWar` | 특수 전법 초기화 |
| `ResetStat.php` | `/InheritAction/ResetStat` | 스탯 초기화 |
| `ResetTurnTime.php` | `/InheritAction/ResetTurnTime` | 턴 시간 초기화 |
| `SetNextSpecialWar.php` | `/InheritAction/SetNextSpecialWar` | 다음 특수 전법 설정 |

#### 💬 Message API (7개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `DecideMessageResponse.php` | `/Message/DecideMessageResponse` | 메시지 응답 결정 |
| `DeleteMessage.php` | `/Message/DeleteMessage` | 메시지 삭제 |
| `GetContactList.php` | `/Message/GetContactList` | 연락처 목록 |
| `GetOldMessage.php` | `/Message/GetOldMessage` | 이전 메시지 조회 |
| `GetRecentMessage.php` | `/Message/GetRecentMessage` | 최근 메시지 조회 |
| `ReadLatestMessage.php` | `/Message/ReadLatestMessage` | 최신 메시지 읽기 |
| `SendMessage.php` | `/Message/SendMessage` | 메시지 전송 |

#### 🏛️ Nation API (9개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `GeneralList.php` | `/Nation/GeneralList` | 세력 소속 장수 목록 |
| `GetGeneralLog.php` | `/Nation/GetGeneralLog` | 세력 장수 로그 |
| `GetNationInfo.php` | `/Nation/GetNationInfo` | 세력 정보 조회 |
| `SetBill.php` | `/Nation/SetBill` | 예산 설정 |
| `SetBlockScout.php` | `/Nation/SetBlockScout` | 정탐 차단 설정 |
| `SetBlockWar.php` | `/Nation/SetBlockWar` | 전쟁 차단 설정 |
| `SetNotice.php` | `/Nation/SetNotice` | 공지 설정 |
| `SetRate.php` | `/Nation/SetRate` | 세율 설정 |
| `SetScoutMsg.php` | `/Nation/SetScoutMsg` | 정탐 메시지 설정 |
| `SetSecretLimit.php` | `/Nation/SetSecretLimit` | 기밀실 제한 설정 |

#### ⚔️ NationCommand API (5개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `GetReservedCommand.php` | `/NationCommand/GetReservedCommand` | 세력 예약 명령 조회 |
| `PushCommand.php` | `/NationCommand/PushCommand` | 세력 명령 밀기 |
| `RepeatCommand.php` | `/NationCommand/RepeatCommand` | 세력 명령 반복 |
| `ReserveBulkCommand.php` | `/NationCommand/ReserveBulkCommand` | 세력 일괄 명령 예약 |
| `ReserveCommand.php` | `/NationCommand/ReserveCommand` | 세력 명령 예약 |

#### 🛡️ Troop API (5개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `ExitTroop.php` | `/Troop/ExitTroop` | 부대 탈퇴 |
| `JoinTroop.php` | `/Troop/JoinTroop` | 부대 가입 |
| `KickFromTroop.php` | `/Troop/KickFromTroop` | 부대원 추방 |
| `NewTroop.php` | `/Troop/NewTroop` | 부대 생성 |
| `SetTroopName.php` | `/Troop/SetTroopName` | 부대명 설정 |

#### 🗳️ Vote API (5개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `AddComment.php` | `/Vote/AddComment` | 투표 댓글 작성 |
| `GetVoteDetail.php` | `/Vote/GetVoteDetail` | 투표 상세 조회 |
| `GetVoteList.php` | `/Vote/GetVoteList` | 투표 목록 조회 |
| `NewVote.php` | `/Vote/NewVote` | 투표 생성 |
| `Vote.php` | `/Vote/Vote` | 투표하기 |

#### 🔧 Misc API (1개)
| 클래스 파일 | API 경로 | 기능 |
|------------|---------|------|
| `UploadImage.php` | `/Misc/UploadImage` | 이미지 업로드 |

### 2.6 추가 PHP 엔드포인트 (`/core/hwe/`)

웹 UI 뷰 파일 (`v_*.php`) - 약 11개:
- `v_NPCControl.php` - NPC 제어
- `v_auction.php` - 경매장
- `v_battleCenter.php` - 전투 센터
- `v_board.php` - 게시판
- `v_cachedMap.php` - 캐시된 맵
- `v_chiefCenter.php` - 사령부
- `v_globalDiplomacy.php` - 전역 외교
- `v_history.php` - 역사
- `v_inheritPoint.php` - 유산 포인트
- `v_join.php` - 가입
- `v_nationBetting.php` - 국가 베팅
- `v_nationGeneral.php` - 세력 장수
- `v_nationStratFinan.php` - 세력 전략/재정
- `v_processing.php` - 명령 처리
- `v_troop.php` - 부대
- `v_vote.php` - 투표

JSON API 엔드포인트 (`j_*.php`) - 약 30개:
- `j_adjust_icon.php` - 아이콘 조정
- `j_autoreset.php` - 자동 리셋
- `j_basic_info.php` - 기본 정보
- `j_board_*.php` - 게시판 관련 (3개)
- `j_diplomacy_*.php` - 외교 관련 (5개)
- `j_export_simulator_object.php` - 시뮬레이터 객체 내보내기
- `j_general_*.php` - 장수 관련 (여러 개)
- `j_get_*.php` - 조회 API (여러 개)
- `j_map*.php` - 맵 관련 (2개)
- `j_raise_event.php` - 이벤트 발생
- `j_select_*.php` - 선택 관련 (여러 개)
- `j_server_basic_info.php` - 서버 기본 정보
- `j_set_*.php` - 설정 관련 (여러 개)
- `j_simulate_battle.php` - 전투 시뮬레이션
- `j_vacation.php` - 휴가

---

## 3. 데이터베이스 이원화 문제 분석

### 3.1 현재 상황

| 항목 | 레거시 (Core) | 신규 백엔드 (open-sam-backend) |
|-----|--------------|------------------------------|
| **데이터베이스** | MySQL | MongoDB |
| **ORM** | MeekroDB, Laravel Eloquent | Mongoose |
| **연결 파일** | `/core/f_install/templates/RootDB.orig.php` | `/open-sam-backend/src/config/db.ts` |
| **테이블/컬렉션** | `general`, `city`, `nation`, `command`, `auction`, `betting`, `vote` 등 | `generals`, `cities`, `nations`, `commands` 등 |
| **데이터 스키마** | 정규화된 관계형 DB | Document 기반 스키마 |

### 3.2 데이터 중복 저장 문제

#### 🔴 중복 데이터 식별

1. **장수(General) 데이터**
   - 레거시: `general` 테이블 (MySQL)
   - 신규: `generals` 컬렉션 (MongoDB)
   - 동기화 없음 → 데이터 불일치 위험

2. **도시(City) 데이터**
   - 레거시: `city` 테이블
   - 신규: `cities` 컬렉션
   - 동기화 없음

3. **세력(Nation) 데이터**
   - 레거시: `nation` 테이블
   - 신규: `nations` 컬렉션
   - 동기화 없음

4. **명령(Command) 데이터**
   - 레거시: `general_turn` 테이블
   - 신규: `commands` 컬렉션
   - 동기화 없음

5. **게임 세션 설정**
   - 레거시: `kv_storage` 테이블 (key-value)
   - 신규: `game_sessions` 컬렉션
   - 동기화 없음

### 3.3 데이터베이스 이원화로 인한 문제점

❌ **문제점**:
1. **데이터 일관성 부재**: 양쪽 DB에 동일 데이터가 있지만 동기화되지 않음
2. **개발 복잡도 증가**: 두 DB 시스템을 모두 유지해야 함
3. **성능 저하**: 레거시 API와 신규 API가 서로 다른 DB를 조회
4. **마이그레이션 리스크**: 데이터 변환 및 검증 필요
5. **운영 부담**: 두 개의 백업, 복구 시스템 필요

### 3.4 현재 상태 진단

```
[레거시 PHP 시스템]                [신규 Node.js 시스템]
      |                                    |
    MySQL                               MongoDB
      |                                    |
  83개 API                            Unified API
      |                                    |
      └─────────── 동기화 없음 ──────────────┘
              ⚠️ 데이터 불일치 위험
```

---

## 4. API 엔드포인트 비교 및 매핑

### 4.1 중복 기능 (일원화 가능)

| 기능 | 레거시 API | 신규 API | 상태 | 우선순위 |
|-----|-----------|---------|------|---------|
| **명령 조회** | `/Command/GetReservedCommand` | `GET /api/command/:id` | 🟡 중복 | HIGH |
| **명령 예약** | `/Command/ReserveCommand` | `POST /api/command/` | 🟡 중복 | HIGH |
| **명령 제출** | `/Command/PushCommand` | `POST /api/command/submit` | 🟡 중복 | HIGH |
| **장수 목록** | `/Global/GeneralList` | `GET /api/unified/entities/general` | 🟡 중복 | HIGH |
| **전투 시스템** | (PHP 코드 내장) | `GET /api/battle/:id` | 🟡 부분 중복 | MEDIUM |
| **게임 설정** | `/Global/GetConst` | `GET /api/admin/config` | 🟡 중복 | MEDIUM |

### 4.2 레거시 고유 기능 (마이그레이션 필요)

| 기능 | 레거시 API | 신규 API | 마이그레이션 필요 |
|-----|-----------|---------|-----------------|
| **경매 시스템** | `/Auction/*` (9개) | ❌ 없음 | ✅ 필요 |
| **베팅 시스템** | `/Betting/*` (3개) | ❌ 없음 | ✅ 필요 |
| **메시지 시스템** | `/Message/*` (7개) | ❌ 없음 | ✅ 필요 |
| **유산 관리** | `/InheritAction/*` (8개) | ❌ 없음 | ✅ 필요 |
| **부대 시스템** | `/Troop/*` (5개) | ❌ 없음 | ✅ 필요 |
| **투표 시스템** | `/Vote/*` (5개) | ❌ 없음 | ✅ 필요 |
| **세력 관리** | `/Nation/*` (9개) | ❌ 부분 구현 | ✅ 필요 |
| **메인 페이지** | `/General/GetFrontInfo` | ❌ 없음 | ✅ 필수 |
| **턴 진행 엔진** | `/Global/ExecuteEngine` | ❌ 없음 | ✅ 필수 |

### 4.3 신규 백엔드 고유 기능

| 기능 | 신규 API | 설명 |
|-----|---------|------|
| **통합 엔티티 API** | `/api/unified/entities/*` | ECS 패턴 기반, 레거시에 없음 |
| **관계 관리** | `/api/unified/edges/*` | 그래프 기반 관계 관리 |
| **시스템 명령** | `/api/unified/entities/:role/:id/systems/:systemId/commands/:command` | 동적 시스템 명령 |

---

## 5. 일원화 권장사항

### 5.1 데이터베이스 일원화 전략

#### 옵션 A: MongoDB로 완전 전환 (권장 ⭐)

**장점**:
- ✅ 신규 시스템 완전 활용
- ✅ ECS 패턴과 잘 맞음
- ✅ 유연한 스키마
- ✅ 수평 확장 용이

**단점**:
- ❌ 레거시 데이터 마이그레이션 필요
- ❌ SQL 기반 쿼리 재작성
- ❌ 개발 기간 증가

**마이그레이션 단계**:
1. 레거시 MySQL 스키마 → MongoDB 스키마 변환 스크립트 작성
2. 데이터 마이그레이션 도구 개발
3. 단계별 테이블 이전 (general → city → nation → ...)
4. 데이터 검증 및 무결성 확인
5. 레거시 API를 MongoDB로 리디렉션
6. MySQL 의존성 완전 제거

#### 옵션 B: MySQL 유지 + MongoDB 병행

**장점**:
- ✅ 레거시 시스템 안정성 유지
- ✅ 점진적 마이그레이션 가능

**단점**:
- ❌ 데이터 동기화 복잡
- ❌ 운영 부담 증가
- ❌ 일관성 문제 지속

#### 옵션 C: Hybrid 접근 (단기 해결책)

**단계 1**: MongoDB를 메인 DB로, MySQL은 읽기 전용
- 모든 쓰기는 MongoDB로
- 레거시 읽기 API는 MySQL 유지
- CDC(Change Data Capture)로 동기화

**단계 2**: 점진적 레거시 API 폐기
- 하나씩 MongoDB 기반 API로 교체

### 5.2 일원화 실행 계획

#### Phase 1: 기반 준비 (2-3주)
1. ✅ 데이터베이스 스키마 매핑 문서 작성
2. ✅ 마이그레이션 스크립트 개발
3. ✅ 테스트 환경 구축
4. ✅ 백업 전략 수립

#### Phase 2: 핵심 데이터 마이그레이션 (3-4주)
1. ✅ `general` → `generals` 마이그레이션
2. ✅ `city` → `cities` 마이그레이션
3. ✅ `nation` → `nations` 마이그레이션
4. ✅ `general_turn` → `commands` 마이그레이션
5. ✅ 데이터 검증 및 무결성 체크

#### Phase 3: API 일원화 (4-6주)
1. ✅ 레거시 API 83개 중 중복 기능 통합
2. ✅ 레거시 고유 기능 신규 백엔드로 이식
   - 경매 시스템 (9개 API)
   - 베팅 시스템 (3개 API)
   - 메시지 시스템 (7개 API)
   - 유산 관리 (8개 API)
   - 부대 시스템 (5개 API)
   - 투표 시스템 (5개 API)
   - 세력 관리 완성 (9개 API)
3. ✅ 핵심 API 이식
   - `GetFrontInfo` (메인 페이지)
   - `ExecuteEngine` (턴 진행)

#### Phase 4: 테스트 및 검증 (2-3주)
1. ✅ 통합 테스트
2. ✅ 부하 테스트
3. ✅ 데이터 일관성 검증
4. ✅ 롤백 시나리오 준비

#### Phase 5: 배포 및 모니터링 (1-2주)
1. ✅ 스테이징 환경 배포
2. ✅ 프로덕션 배포
3. ✅ 모니터링 및 오류 수정
4. ✅ 레거시 시스템 폐기

---

## 6. 구체적인 실행 로드맵

### 6.1 우선순위별 API 마이그레이션

#### 🔴 High Priority (즉시 필요)
1. **GetFrontInfo** (`/General/GetFrontInfo`)
   - 메인 페이지 핵심 API
   - 전역/세력/장수/도시 정보 통합 제공
   - 신규 엔드포인트: `GET /api/game/front-info`

2. **ExecuteEngine** (`/Global/ExecuteEngine`)
   - 턴 진행 엔진
   - 게임 로직 핵심
   - 신규 엔드포인트: `POST /api/game/execute-turn`

3. **Command System** (5개)
   - 명령 예약/조회/수정/삭제
   - 이미 부분 구현됨 → 완성 필요

#### 🟡 Medium Priority (중요)
4. **Auction System** (9개)
   - 신규 라우터: `/api/auction/`
   - MongoDB 스키마 설계 필요

5. **Message System** (7개)
   - 신규 라우터: `/api/message/`
   - 실시간 메시징 고려 (Socket.IO)

6. **Troop System** (5개)
   - 신규 라우터: `/api/troop/`

7. **Vote System** (5개)
   - 신규 라우터: `/api/vote/`

#### 🟢 Low Priority (필요 시)
8. **Betting System** (3개)
9. **InheritAction** (8개)
10. **Misc** (1개 - 이미지 업로드)

### 6.2 데이터베이스 마이그레이션 스크립트 예시

```typescript
// /open-sam-backend/scripts/migrate-general.ts
import { connectDB } from '../src/config/db';
import { General } from '../src/models/general.model';
import mysql from 'mysql2/promise';

async function migrateGenerals() {
  // MySQL 연결
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  // MongoDB 연결
  await connectDB();

  // 장수 데이터 조회
  const [rows] = await mysqlConn.query('SELECT * FROM general');

  // MongoDB로 마이그레이션
  for (const row of rows as any[]) {
    await General.create({
      no: row.no,
      name: row.name,
      nation: row.nation,
      city: row.city,
      leadership: row.leadership,
      strength: row.strength,
      intel: row.intel,
      // ... 나머지 필드 매핑
    });
  }

  console.log(`✅ ${rows.length}개 장수 마이그레이션 완료`);
  await mysqlConn.end();
}

migrateGenerals().catch(console.error);
```

### 6.3 API 변환 예시

#### Before (레거시 PHP):
```php
// /core/hwe/sammo/API/General/GetFrontInfo.php
class GetFrontInfo extends \sammo\BaseAPI {
  public function launch(Session $session, ...) {
    $db = DB::db();
    $general = General::createObjFromDB($generalID, ...);
    
    return [
      'global' => $this->generateGlobalInfo($db),
      'nation' => $this->generateNationInfo($db, $general, $rawNation),
      'general' => $this->generateGeneralInfo($db, $general, $rawNation),
      'city' => $this->generateCityInfo($db, $general, $rawNation),
    ];
  }
}
```

#### After (신규 TypeScript):
```typescript
// /open-sam-backend/src/api/game/controller/front-info.controller.ts
export class FrontInfoController {
  async getFrontInfo(req: Request, res: Response) {
    const generalId = req.session.generalId;
    const general = await General.findOne({ no: generalId });
    
    const globalInfo = await this.generateGlobalInfo();
    const nationInfo = await this.generateNationInfo(general);
    const generalInfo = await this.generateGeneralInfo(general);
    const cityInfo = await this.generateCityInfo(general);
    
    res.json({
      result: true,
      global: globalInfo,
      nation: nationInfo,
      general: generalInfo,
      city: cityInfo,
    });
  }
}

// 라우터 등록
router.get('/front-info', authMiddleware, frontInfoController.getFrontInfo);
```

---

## 7. 리스크 관리

### 7.1 주요 리스크

| 리스크 | 영향도 | 발생 확률 | 완화 방안 |
|-------|--------|----------|----------|
| **데이터 손실** | 🔴 HIGH | 🟡 MEDIUM | 완전한 백업, 단계적 마이그레이션 |
| **데이터 불일치** | 🔴 HIGH | 🔴 HIGH | 검증 스크립트, 롤백 계획 |
| **서비스 중단** | 🟡 MEDIUM | 🟡 MEDIUM | 블루-그린 배포, 카나리 릴리스 |
| **성능 저하** | 🟡 MEDIUM | 🟢 LOW | 부하 테스트, 인덱스 최적화 |
| **개발 지연** | 🟡 MEDIUM | 🔴 HIGH | 명확한 일정, 우선순위 관리 |

### 7.2 롤백 계획

1. **백업 전략**
   - 마이그레이션 전 MySQL 전체 백업
   - MongoDB 스냅샷
   - 애플리케이션 코드 Git 태그

2. **단계별 롤백**
   - Phase별 체크포인트 설정
   - 문제 발생 시 이전 Phase로 복귀
   - 레거시 시스템 유지 (일정 기간)

3. **모니터링**
   - 에러율 모니터링
   - 응답 시간 모니터링
   - 데이터 일관성 모니터링

---

## 8. 예상 소요 시간 및 리소스

### 8.1 인력 산정
- **백엔드 개발자**: 2명 (풀타임)
- **데이터베이스 엔지니어**: 1명 (파트타임)
- **QA 엔지니어**: 1명 (풀타임)
- **DevOps 엔지니어**: 1명 (파트타임)

### 8.2 전체 일정
- **총 소요 기간**: 12-18주 (약 3-4개월)
- **Phase 1**: 2-3주
- **Phase 2**: 3-4주
- **Phase 3**: 4-6주
- **Phase 4**: 2-3주
- **Phase 5**: 1-2주

### 8.3 예산 추정
- 인건비: (산정 필요)
- 인프라 비용: (MongoDB 클러스터, Redis, 테스트 환경)
- 도구 및 라이선스: (모니터링 도구 등)

---

## 9. 결론

### 9.1 현황 요약
- ✅ **레거시 API**: 83개 (PHP + MySQL)
- ✅ **신규 API**: 부분 구현 (TypeScript + MongoDB)
- ❌ **데이터베이스**: 이원화 (MySQL ↔ MongoDB)
- ❌ **동기화**: 없음 → 데이터 불일치 위험

### 9.2 최종 권장사항

#### 🎯 MongoDB로 완전 전환 (옵션 A 선택)
1. 레거시 MySQL 데이터를 MongoDB로 마이그레이션
2. 레거시 API 83개 중 핵심 기능 우선 이식
3. 단계적 배포 및 검증
4. 레거시 시스템 최종 폐기

#### 📋 실행 단계
1. **즉시 시작**: GetFrontInfo, ExecuteEngine 이식
2. **병행 개발**: Auction, Message, Troop, Vote 시스템
3. **데이터 마이그레이션**: 단계별 테이블 이전
4. **테스트**: 통합 테스트 및 검증
5. **배포**: 블루-그린 배포

### 9.3 기대 효과
- ✅ **단일 데이터베이스**: 일관성 보장
- ✅ **단일 API 시스템**: 유지보수 간소화
- ✅ **성능 향상**: MongoDB의 유연성 활용
- ✅ **개발 생산성**: TypeScript + Express.js 생태계
- ✅ **확장성**: 수평 확장 용이

---

**보고서 작성일**: 2025-11-01
**작성자**: OpenCode AI Assistant
**버전**: 1.0


---

## 부록 A: API 엔드포인트 상세 매핑 테이블

### A.1 Command API 매핑

| 레거시 PHP | 신규 TypeScript | HTTP 메서드 | 상태 | 비고 |
|-----------|----------------|-------------|------|------|
| `/Command/GetReservedCommand` | `GET /api/command/:id` | GET | ✅ 구현 | ID 기반 조회 |
| `/Command/ReserveCommand` | `POST /api/command/` | POST | ✅ 구현 | 명령 생성 |
| `/Command/PushCommand` | `POST /api/command/submit` | POST | ✅ 구현 | 명령 제출 |
| `/Command/RepeatCommand` | `POST /api/command/repeat` | POST | ❌ 미구현 | 반복 기능 필요 |
| `/Command/ReserveBulkCommand` | `POST /api/command/bulk` | POST | ❌ 미구현 | 일괄 처리 필요 |

### A.2 General API 매핑

| 레거시 PHP | 신규 TypeScript | HTTP 메서드 | 상태 | 비고 |
|-----------|----------------|-------------|------|------|
| `/General/GetFrontInfo` | `GET /api/game/front-info` | GET | ❌ 미구현 | **최우선 이식 필요** |
| `/General/Join` | `POST /api/general/join` | POST | ✅ 구현 | 게임 참가 |
| `/General/GetCommandTable` | `GET /api/general/:id/commands` | GET | ❌ 미구현 | 명령표 조회 |
| `/General/GetGeneralLog` | `GET /api/general/:id/logs` | GET | ❌ 미구현 | 로그 조회 |
| `/General/DropItem` | `DELETE /api/general/:id/item/:itemId` | DELETE | ❌ 미구현 | 아이템 버리기 |
| `/General/InstantRetreat` | `POST /api/general/:id/retreat` | POST | ❌ 미구현 | 즉시 후퇴 |
| `/General/BuildNationCandidate` | `POST /api/general/:id/nation-candidate` | POST | ❌ 미구현 | 건국 후보 |
| `/General/DieOnPrestart` | `DELETE /api/general/:id/prestart` | DELETE | ❌ 미구현 | 시작 전 사망 |

### A.3 Global API 매핑

| 레거시 PHP | 신규 TypeScript | HTTP 메서드 | 상태 | 비고 |
|-----------|----------------|-------------|------|------|
| `/Global/ExecuteEngine` | `POST /api/game/execute-turn` | POST | ❌ 미구현 | **핵심 엔진** |
| `/Global/GetMap` | `GET /api/game/map` | GET | ❌ 미구현 | 맵 정보 |
| `/Global/GetCachedMap` | `GET /api/game/map/cached` | GET | ❌ 미구현 | 캐시된 맵 |
| `/Global/GetConst` | `GET /api/game/constants` | GET | ✅ 구현 | 게임 상수 |
| `/Global/GeneralList` | `GET /api/unified/entities/general` | GET | ✅ 구현 | 통합 API 사용 |
| `/Global/GeneralListWithToken` | `GET /api/general/list?token=xxx` | GET | ❌ 미구현 | 토큰 기반 조회 |
| `/Global/GetHistory` | `GET /api/game/history` | GET | ❌ 미구현 | 역사 기록 |
| `/Global/GetCurrentHistory` | `GET /api/game/history/current` | GET | ❌ 미구현 | 현재 역사 |
| `/Global/GetDiplomacy` | `GET /api/diplomacy` | GET | ❌ 미구현 | 외교 정보 |
| `/Global/GetGlobalMenu` | `GET /api/game/menu` | GET | ❌ 미구현 | 전역 메뉴 |

### A.4 미구현 레거시 기능 (신규 구현 필요)

#### 🏪 Auction (경매) - 9개 API
```typescript
// 신규 라우터: /api/auction/
POST   /api/auction/rice/buy/open          // 쌀 구매 경매 열기
POST   /api/auction/rice/sell/open         // 쌀 판매 경매 열기
POST   /api/auction/unique/open            // 유니크 경매 열기
POST   /api/auction/:id/bid                // 경매 입찰
GET    /api/auction/resource/active        // 활성 자원 경매 목록
GET    /api/auction/unique                 // 유니크 경매 목록
GET    /api/auction/unique/:id             // 유니크 경매 상세
```

#### 🎲 Betting (베팅) - 3개 API
```typescript
// 신규 라우터: /api/betting/
POST   /api/betting/:id                    // 베팅하기
GET    /api/betting                        // 베팅 목록
GET    /api/betting/:id                    // 베팅 상세
```

#### 💬 Message (메시지) - 7개 API
```typescript
// 신규 라우터: /api/message/
POST   /api/message/send                   // 메시지 전송
GET    /api/message/recent                 // 최근 메시지
GET    /api/message/old                    // 이전 메시지
GET    /api/message/contacts               // 연락처 목록
PUT    /api/message/read-latest            // 최신 메시지 읽기
PUT    /api/message/:id/respond            // 메시지 응답
DELETE /api/message/:id                    // 메시지 삭제
```

#### 💰 InheritAction (유산) - 8개 API
```typescript
// 신규 라우터: /api/inherit/
POST   /api/inherit/check-owner            // 소유자 확인
POST   /api/inherit/buy-hidden-buff        // 히든 버프 구매
POST   /api/inherit/buy-random-unique      // 랜덤 유니크 구매
POST   /api/inherit/reset-stat             // 스탯 초기화
POST   /api/inherit/reset-special-war      // 특수 전법 초기화
POST   /api/inherit/set-next-special-war   // 다음 특수 전법 설정
POST   /api/inherit/reset-turn-time        // 턴 시간 초기화
GET    /api/inherit/logs                   // 추가 로그 조회
```

#### 🛡️ Troop (부대) - 5개 API
```typescript
// 신규 라우터: /api/troop/
POST   /api/troop                          // 부대 생성
POST   /api/troop/:id/join                 // 부대 가입
DELETE /api/troop/:id/exit                 // 부대 탈퇴
DELETE /api/troop/:id/kick/:generalId      // 부대원 추방
PUT    /api/troop/:id/name                 // 부대명 설정
```

#### 🗳️ Vote (투표) - 5개 API
```typescript
// 신규 라우터: /api/vote/
POST   /api/vote                           // 투표 생성
POST   /api/vote/:id                       // 투표하기
POST   /api/vote/:id/comment               // 댓글 작성
GET    /api/vote                           // 투표 목록
GET    /api/vote/:id                       // 투표 상세
```

#### 🏛️ Nation (세력) - 9개 API
```typescript
// 신규 라우터: /api/nation/
GET    /api/nation/:id/info                // 세력 정보
GET    /api/nation/:id/generals            // 세력 장수 목록
GET    /api/nation/:id/logs                // 세력 로그
PUT    /api/nation/:id/bill                // 예산 설정
PUT    /api/nation/:id/tax-rate            // 세율 설정
PUT    /api/nation/:id/notice              // 공지 설정
PUT    /api/nation/:id/scout-msg           // 정탐 메시지 설정
PUT    /api/nation/:id/block-scout         // 정탐 차단
PUT    /api/nation/:id/block-war           // 전쟁 차단
PUT    /api/nation/:id/secret-limit        // 기밀실 제한
```

---

## 부록 B: 데이터베이스 스키마 비교

### B.1 General (장수) 테이블/컬렉션 비교

#### MySQL 스키마 (레거시)
```sql
CREATE TABLE general (
    no INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    nation INT DEFAULT 0,
    city INT DEFAULT 0,
    npc INT DEFAULT 0,
    officer_level INT DEFAULT 1,
    officer_city INT DEFAULT 0,
    leadership INT DEFAULT 50,
    strength INT DEFAULT 50,
    intel INT DEFAULT 50,
    leadership_exp INT DEFAULT 0,
    strength_exp INT DEFAULT 0,
    intel_exp INT DEFAULT 0,
    gold INT DEFAULT 10000,
    rice INT DEFAULT 10000,
    crew INT DEFAULT 1000,
    crewtype VARCHAR(50) DEFAULT ' 의병',
    train INT DEFAULT 0,
    atmos INT DEFAULT 50,
    age INT DEFAULT 20,
    injury INT DEFAULT 0,
    experience INT DEFAULT 0,
    dedication INT DEFAULT 0,
    explevel INT DEFAULT 0,
    dedlevel INT DEFAULT 0,
    turntime DATETIME,
    recent_war VARCHAR(20),
    killturn INT DEFAULT 0,
    troop INT DEFAULT 0,
    belong INT DEFAULT 0,
    
    -- 능력치
    dex1 INT DEFAULT 0,
    dex2 INT DEFAULT 0,
    dex3 INT DEFAULT 0,
    dex4 INT DEFAULT 0,
    dex5 INT DEFAULT 0,
    
    -- 아이템
    horse VARCHAR(100),
    weapon VARCHAR(100),
    book VARCHAR(100),
    item VARCHAR(100),
    
    -- 특성
    special VARCHAR(100),
    special2 VARCHAR(100),
    personal VARCHAR(100),
    
    -- 이미지
    picture VARCHAR(255),
    imgsvr TINYINT DEFAULT 0,
    
    -- 기타
    specage INT DEFAULT 0,
    specage2 INT DEFAULT 0,
    defence_train INT DEFAULT 0,
    owner_name VARCHAR(255),
    
    -- 인덱스
    INDEX idx_nation (nation),
    INDEX idx_city (city),
    INDEX idx_troop (troop)
);
```

#### MongoDB 스키마 (신규)
```typescript
// /open-sam-backend/src/models/general.model.ts
interface IGeneral {
  no: number;                    // 장수 번호 (MySQL과 동일)
  session_id: string;            // 게임 세션 ID (추가)
  name: string;
  
  // 소속 정보
  nation: number;
  city: number;
  npc: number;                   // NPC 타입
  
  // 직위
  officer_level: number;
  officer_city: number;
  
  // 기본 능력치
  data: {
    leadership: number;
    strength: number;
    intel: number;
    
    // 경험치
    leadership_exp: number;
    strength_exp: number;
    intel_exp: number;
    
    // 자원
    gold: number;
    rice: number;
    
    // 병사
    crew: number;
    crewtype: string;
    train: number;
    atmos: number;
    
    // 상태
    age: number;
    injury: number;
    experience: number;
    dedication: number;
    explevel: number;
    dedlevel: number;
    killturn: number;
    
    // 능력치
    dex1: number;
    dex2: number;
    dex3: number;
    dex4: number;
    dex5: number;
    
    // 아이템 (객체로 변경 가능)
    horse?: string;
    weapon?: string;
    book?: string;
    item?: string;
    
    // 특성
    special?: string;
    special2?: string;
    personal?: string;
    
    // 이미지
    picture?: string;
    imgsvr: number;
    
    // 부대
    troop: number;
    belong: number;
    
    // 기타
    defence_train: number;
    owner_name?: string;
    specage: number;
    specage2: number;
  };
  
  // 턴 정보
  turntime: Date;
  recent_war?: string;
  
  // 메타데이터
  created_at: Date;
  updated_at: Date;
}

// 인덱스
generalSchema.index({ no: 1, session_id: 1 }, { unique: true });
generalSchema.index({ nation: 1 });
generalSchema.index({ city: 1 });
generalSchema.index({ 'data.owner_name': 1 });
```

### B.2 City (도시) 스키마 비교

#### MySQL
```sql
CREATE TABLE city (
    city INT PRIMARY KEY,
    name VARCHAR(255),
    nation INT DEFAULT 0,
    level INT DEFAULT 1,
    
    -- 인구 및 자원
    pop INT DEFAULT 10000,
    pop_max INT DEFAULT 15000,
    agri INT DEFAULT 500,
    agri_max INT DEFAULT 1000,
    comm INT DEFAULT 500,
    comm_max INT DEFAULT 1000,
    secu INT DEFAULT 500,
    secu_max INT DEFAULT 1000,
    def INT DEFAULT 500,
    def_max INT DEFAULT 1000,
    wall INT DEFAULT 500,
    wall_max INT DEFAULT 1000,
    
    -- 기타
    trust INT DEFAULT 50,
    trade VARCHAR(20),
    
    INDEX idx_nation (nation)
);
```

#### MongoDB
```typescript
interface ICity {
  session_id: string;
  city: number;                  // 도시 번호
  name: string;
  nation: number;
  
  data: {
    level: number;
    
    // 인구 및 자원
    pop: number;
    pop_max: number;
    agri: number;
    agri_max: number;
    comm: number;
    comm_max: number;
    secu: number;
    secu_max: number;
    def: number;
    def_max: number;
    wall: number;
    wall_max: number;
    
    // 기타
    trust: number;
    trade?: string;
  };
  
  created_at: Date;
  updated_at: Date;
}

citySchema.index({ city: 1, session_id: 1 }, { unique: true });
citySchema.index({ nation: 1 });
```

### B.3 Nation (세력) 스키마 비교

#### MySQL
```sql
CREATE TABLE nation (
    nation INT PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(50),
    color INT,
    level INT DEFAULT 1,
    capital INT DEFAULT 0,
    
    -- 자원
    gold INT DEFAULT 50000,
    rice INT DEFAULT 50000,
    tech INT DEFAULT 0,
    
    -- 세력 정보
    gennum INT DEFAULT 0,
    power INT DEFAULT 0,
    
    -- 설정
    bill INT DEFAULT 1,
    rate INT DEFAULT 5,
    
    -- 외교/전략
    surlimit INT DEFAULT 5,
    strategic_cmd_limit INT DEFAULT 3,
    
    -- 제한
    scout TINYINT DEFAULT 0,
    war TINYINT DEFAULT 0
);
```

#### MongoDB
```typescript
interface INation {
  session_id: string;
  nation: number;
  name: string;
  
  data: {
    type: string;
    color: number;
    level: number;
    capital: number;
    
    // 자원
    gold: number;
    rice: number;
    tech: number;
    
    // 세력 정보
    gennum: number;
    power: number;
    
    // 설정
    bill: number;
    rate: number;
    
    // 외교/전략
    surlimit: number;
    strategic_cmd_limit: number;
    
    // 제한
    scout: boolean;
    war: boolean;
  };
  
  created_at: Date;
  updated_at: Date;
}

nationSchema.index({ nation: 1, session_id: 1 }, { unique: true });
```

### B.4 마이그레이션 주요 고려사항

#### 1. 데이터 타입 변환
| MySQL | MongoDB | 변환 로직 |
|-------|---------|----------|
| `INT` | `Number` | 직접 변환 |
| `VARCHAR` | `String` | 직접 변환 |
| `DATETIME` | `Date` | `new Date(mysqlDatetime)` |
| `TINYINT` | `Boolean` | `!!value` |
| `NULL` | `undefined` | 선택적 필드 |

#### 2. 데이터 구조 변경
- **Flat → Nested**: MySQL의 평면 구조를 MongoDB의 `data` 객체로 중첩
- **Index 재설계**: 복합 인덱스 추가 (`session_id` + `no`)
- **Timestamp 추가**: `created_at`, `updated_at` 자동 관리

#### 3. 무결성 보장
- **Foreign Key → Ref**: MySQL의 외래키를 MongoDB의 참조로 변환
- **Cascade 처리**: 삭제 시 연관 데이터 처리 로직 필요
- **Validation**: Mongoose 스키마 검증 활용

---

## 부록 C: 실전 마이그레이션 스크립트

### C.1 General 마이그레이션 스크립트

```typescript
// /open-sam-backend/scripts/migrate-generals.ts
import { connectDB } from '../src/config/db';
import { General } from '../src/models/general.model';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

interface MysqlGeneral {
  no: number;
  name: string;
  nation: number;
  city: number;
  npc: number;
  officer_level: number;
  officer_city: number;
  leadership: number;
  strength: number;
  intel: number;
  leadership_exp: number;
  strength_exp: number;
  intel_exp: number;
  gold: number;
  rice: number;
  crew: number;
  crewtype: string;
  train: number;
  atmos: number;
  age: number;
  injury: number;
  experience: number;
  dedication: number;
  explevel: number;
  dedlevel: number;
  turntime: Date;
  recent_war?: string;
  killturn: number;
  troop: number;
  belong: number;
  dex1: number;
  dex2: number;
  dex3: number;
  dex4: number;
  dex5: number;
  horse?: string;
  weapon?: string;
  book?: string;
  item?: string;
  special?: string;
  special2?: string;
  personal?: string;
  picture?: string;
  imgsvr: number;
  specage: number;
  specage2: number;
  defence_train: number;
  owner_name?: string;
}

async function migrateGenerals(sessionId: string = 'sangokushi_default') {
  console.log('🚀 장수 마이그레이션 시작...');
  
  // MySQL 연결
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sangokushi'
  });

  // MongoDB 연결
  await connectDB();

  try {
    // 기존 데이터 삭제 (선택적)
    const deleteCount = await General.deleteMany({ session_id: sessionId });
    console.log(`🗑️  기존 장수 ${deleteCount.deletedCount}개 삭제`);

    // MySQL에서 장수 데이터 조회
    const [rows] = await mysqlConn.query<MysqlGeneral[]>(
      'SELECT * FROM general ORDER BY no ASC'
    );

    console.log(`📊 총 ${rows.length}개 장수 발견`);

    let successCount = 0;
    let errorCount = 0;

    // 배치 처리 (1000개씩)
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const generals = batch.map((row) => ({
        session_id: sessionId,
        no: row.no,
        name: row.name,
        nation: row.nation,
        city: row.city,
        npc: row.npc,
        officer_level: row.officer_level,
        officer_city: row.officer_city,
        turntime: row.turntime,
        recent_war: row.recent_war,
        data: {
          leadership: row.leadership,
          strength: row.strength,
          intel: row.intel,
          leadership_exp: row.leadership_exp,
          strength_exp: row.strength_exp,
          intel_exp: row.intel_exp,
          gold: row.gold,
          rice: row.rice,
          crew: row.crew,
          crewtype: row.crewtype,
          train: row.train,
          atmos: row.atmos,
          age: row.age,
          injury: row.injury,
          experience: row.experience,
          dedication: row.dedication,
          explevel: row.explevel,
          dedlevel: row.dedlevel,
          killturn: row.killturn,
          troop: row.troop,
          belong: row.belong,
          dex1: row.dex1,
          dex2: row.dex2,
          dex3: row.dex3,
          dex4: row.dex4,
          dex5: row.dex5,
          horse: row.horse,
          weapon: row.weapon,
          book: row.book,
          item: row.item,
          special: row.special,
          special2: row.special2,
          personal: row.personal,
          picture: row.picture,
          imgsvr: row.imgsvr,
          specage: row.specage,
          specage2: row.specage2,
          defence_train: row.defence_train,
          owner_name: row.owner_name,
        }
      }));

      try {
        await General.insertMany(generals, { ordered: false });
        successCount += generals.length;
        console.log(`✅ 배치 ${Math.floor(i / batchSize) + 1}: ${generals.length}개 마이그레이션 성공 (누적: ${successCount}/${rows.length})`);
      } catch (error: any) {
        if (error.code === 11000) {
          // 중복 키 에러 - 개별 처리
          for (const general of generals) {
            try {
              await General.create(general);
              successCount++;
            } catch (err) {
              errorCount++;
              console.error(`❌ 장수 ${general.no} 마이그레이션 실패:`, err);
            }
          }
        } else {
          throw error;
        }
      }
    }

    console.log('\n📊 마이그레이션 결과:');
    console.log(`  - 성공: ${successCount}개`);
    console.log(`  - 실패: ${errorCount}개`);
    console.log(`  - 성공률: ${((successCount / rows.length) * 100).toFixed(2)}%`);

    // 검증
    const mongoCount = await General.countDocuments({ session_id: sessionId });
    console.log(`\n✔️  MongoDB 장수 수: ${mongoCount}`);
    console.log(`✔️  MySQL 장수 수: ${rows.length}`);
    
    if (mongoCount === rows.length) {
      console.log('✅ 데이터 수 일치!');
    } else {
      console.warn(`⚠️  데이터 수 불일치! 차이: ${Math.abs(mongoCount - rows.length)}개`);
    }

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  } finally {
    await mysqlConn.end();
    console.log('🔌 MySQL 연결 종료');
  }
}

// 실행
migrateGenerals()
  .then(() => {
    console.log('\n✅ 마이그레이션 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 마이그레이션 오류:', error);
    process.exit(1);
  });
```

### C.2 데이터 검증 스크립트

```typescript
// /open-sam-backend/scripts/validate-migration.ts
import { connectDB } from '../src/config/db';
import { General } from '../src/models/general.model';
import { City } from '../src/models/city.model';
import { Nation } from '../src/models/nation.model';
import mysql from 'mysql2/promise';

async function validateMigration(sessionId: string = 'sangokushi_default') {
  console.log('🔍 마이그레이션 검증 시작...\n');

  // MySQL 연결
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sangokushi'
  });

  // MongoDB 연결
  await connectDB();

  try {
    // 1. 레코드 수 비교
    console.log('📊 1. 레코드 수 비교');
    
    const [mysqlGenerals] = await mysqlConn.query('SELECT COUNT(*) as count FROM general');
    const mongoGenerals = await General.countDocuments({ session_id: sessionId });
    console.log(`  장수: MySQL=${mysqlGenerals[0].count}, MongoDB=${mongoGenerals} ${mysqlGenerals[0].count === mongoGenerals ? '✅' : '❌'}`);
    
    const [mysqlCities] = await mysqlConn.query('SELECT COUNT(*) as count FROM city');
    const mongoCities = await City.countDocuments({ session_id: sessionId });
    console.log(`  도시: MySQL=${mysqlCities[0].count}, MongoDB=${mongoCities} ${mysqlCities[0].count === mongoCities ? '✅' : '❌'}`);
    
    const [mysqlNations] = await mysqlConn.query('SELECT COUNT(*) as count FROM nation');
    const mongoNations = await Nation.countDocuments({ session_id: sessionId });
    console.log(`  세력: MySQL=${mysqlNations[0].count}, MongoDB=${mongoNations} ${mysqlNations[0].count === mongoNations ? '✅' : '❌'}`);

    // 2. 샘플 데이터 비교
    console.log('\n📋 2. 샘플 데이터 비교 (장수 ID 1-10)');
    
    const [mysqlSamples] = await mysqlConn.query(
      'SELECT no, name, nation, leadership, strength, intel, gold FROM general WHERE no BETWEEN 1 AND 10 ORDER BY no'
    );
    
    for (const sample of mysqlSamples as any[]) {
      const mongoGeneral = await General.findOne({ 
        session_id: sessionId, 
        no: sample.no 
      });
      
      if (!mongoGeneral) {
        console.log(`  ❌ 장수 ${sample.no} (${sample.name}): MongoDB에 없음`);
        continue;
      }
      
      const match = 
        mongoGeneral.name === sample.name &&
        mongoGeneral.nation === sample.nation &&
        mongoGeneral.data.leadership === sample.leadership &&
        mongoGeneral.data.strength === sample.strength &&
        mongoGeneral.data.intel === sample.intel &&
        mongoGeneral.data.gold === sample.gold;
      
      console.log(`  ${match ? '✅' : '❌'} 장수 ${sample.no} (${sample.name})`);
      
      if (!match) {
        console.log(`     MySQL:   leadership=${sample.leadership}, strength=${sample.strength}, intel=${sample.intel}, gold=${sample.gold}`);
        console.log(`     MongoDB: leadership=${mongoGeneral.data.leadership}, strength=${mongoGeneral.data.strength}, intel=${mongoGeneral.data.intel}, gold=${mongoGeneral.data.gold}`);
      }
    }

    // 3. 데이터 무결성 확인
    console.log('\n🔗 3. 데이터 무결성 확인');
    
    // 세력 소속 장수 수
    const [mysqlNationStats] = await mysqlConn.query(
      'SELECT nation, COUNT(*) as count FROM general GROUP BY nation ORDER BY nation'
    );
    
    for (const stat of mysqlNationStats as any[]) {
      const mongoCount = await General.countDocuments({ 
        session_id: sessionId, 
        nation: stat.nation 
      });
      const match = mongoCount === stat.count;
      console.log(`  ${match ? '✅' : '❌'} 세력 ${stat.nation}: MySQL=${stat.count}, MongoDB=${mongoCount}`);
    }

    // 4. NULL/undefined 값 확인
    console.log('\n🔍 4. NULL/undefined 값 확인');
    
    const generalsWithNulls = await General.find({
      session_id: sessionId,
      $or: [
        { 'data.horse': null },
        { 'data.weapon': null },
        { 'data.book': null },
        { 'data.item': null }
      ]
    }).limit(5);
    
    console.log(`  null 아이템 보유 장수: ${generalsWithNulls.length}개 (샘플)`);
    generalsWithNulls.forEach(g => {
      console.log(`    - 장수 ${g.no} (${g.name}): horse=${g.data.horse}, weapon=${g.data.weapon}`);
    });

    console.log('\n✅ 검증 완료!');

  } catch (error) {
    console.error('❌ 검증 오류:', error);
    throw error;
  } finally {
    await mysqlConn.end();
  }
}

// 실행
validateMigration()
  .then(() => {
    console.log('\n✅ 검증 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 검증 오류:', error);
    process.exit(1);
  });
```

---

## 부록 D: 프로젝트 실행 명령어

### D.1 레거시 시스템 (PHP)

```bash
# 1. 의존성 설치
cd /mnt/e/opensam/core
composer install

# 2. 설정 파일 생성
cp f_config/config.example.php f_config/config.php

# 3. 데이터베이스 설정
# config.php 파일에서 MySQL 정보 입력

# 4. Apache/Nginx 설정
# DocumentRoot를 /mnt/e/opensam/core로 설정

# 5. API 테스트
curl http://localhost/api.php?path=Global/GetConst
```

### D.2 신규 백엔드 (Node.js)

```bash
# 1. 의존성 설치
cd /mnt/e/opensam/open-sam-backend
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일에서 MongoDB, Redis 정보 입력

# 3. MongoDB 시작
# Docker 사용:
docker run -d -p 27017:27017 --name mongodb mongo:latest

# 또는 로컬 설치:
mongod --dbpath /data/db

# 4. Redis 시작 (선택적)
docker run -d -p 6379:6379 --name redis redis:latest

# 5. 개발 서버 실행
npm run dev

# 6. 프로덕션 빌드
npm run build
npm start

# 7. API 테스트
curl http://localhost:3000/health
curl http://localhost:3000/api/admin/system/status
```

### D.3 마이그레이션 스크립트 실행

```bash
# 1. TypeScript 컴파일
cd /mnt/e/opensam/open-sam-backend
npm run build

# 2. 장수 마이그레이션
npx ts-node scripts/migrate-generals.ts

# 3. 도시 마이그레이션
npx ts-node scripts/migrate-cities.ts

# 4. 세력 마이그레이션
npx ts-node scripts/migrate-nations.ts

# 5. 검증
npx ts-node scripts/validate-migration.ts

# 6. 전체 마이그레이션 (순서대로)
npx ts-node scripts/migrate-all.ts
```

### D.4 API 문서 확인

```bash
# Swagger UI 접속
open http://localhost:3000/api-docs

# Swagger JSON 다운로드
curl http://localhost:3000/api-docs.json > swagger.json
```

---

**보고서 업데이트일**: 2025-11-01
**버전**: 1.1 (부록 포함)

