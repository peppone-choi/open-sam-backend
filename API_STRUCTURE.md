# API 폴더 구조 문서

## 📁 현재 구조 (Lore 중립화 완료)

### 🎯 핵심 중립 시스템

#### 엔티티 & 데이터
```
src/api/
├── unified/             통합 Entity API (/api/entities)
├── v2/                  v2 API (/v2/settlements, /v2/commanders 등)
├── commander/           Commander 엔티티 (마이그레이션 중)
├── settlement/          Settlement 엔티티 (마이그레이션 중)
├── faction/             Faction 엔티티 (마이그레이션 중)
```

#### 게임 로직
```
├── command/             커맨드 시스템 (CQRS)
├── battle/              40x40 전투 시스템
├── daemon/              백그라운드 프로세서
│   ├── command-processor.ts
│   ├── command-completer.ts
│   ├── turn-scheduler.ts
│   └── handlers/        커맨드 핸들러 (62개)
├── websocket/           웹소켓 실시간 통신
```

#### 보조 시스템
```
├── commander-access-log/ Commander 접속 로그
├── commander-record/     Commander 기록
├── commander-turn/       Commander 턴 정보
├── faction-env/          Faction 환경 변수
├── faction-turn/         Faction 턴 정보
├── game-session/         게임 세션 관리
```

#### 게임 메타 기능
```
├── event/               이벤트 시스템
├── item/                아이템 시스템
├── message/             메시지
├── rank-data/           랭킹
├── user-record/         유저 기록
├── world-history/       세계 히스토리
├── storage/             저장소
```

#### 게임 외 기능
```
├── board/               게시판
├── comment/             댓글
├── vote/                투표
├── admin/               어드민 API
├── config/              설정
```

#### 기타/레거시
```
├── battlefield-tile/    전투 타일 (battle 통합 검토)
├── troop/               부대 (entities FORCE로 통합 검토)
├── ng-auction/          경매 (레거시)
├── ng-betting/          베팅 (레거시)
├── ng-history/          히스토리 (레거시)
├── plock/               잠금
├── reserved-open/       예약 오픈
├── select-npc-token/    NPC 토큰
├── select-pool/         선택 풀
```

## 🎯 마이그레이션 로드맵

### Phase 1: Entity 통합 완료 ✅
- ✅ Entity 모델 생성
- ✅ EntityRepository 구현
- ✅ 통합 API 라우터
- ✅ 삼국지 시나리오 등록
- ✅ 마이그레이션 스크립트 준비

### Phase 2: 레거시 제거 (예정)
- commander/settlement/faction → entities 완전 통합
- troop → entities (FORCE)
- battlefield-tile → battle
- ng-* 레거시 제거

### Phase 3: 시스템 플러그인화 (예정)
- item → ItemSystem
- event → EventSystem
- message → MessageSystem

## 📊 TypeScript 빌드: ✅ 0 errors

## 🔗 관련 문서

- [SCENARIO_GUIDE.md](file:///mnt/d/open-sam-backend/SCENARIO_GUIDE.md) - 시나리오 등록/수정 가이드
- [API_ROUTES.md](file:///mnt/d/open-sam-backend/API_ROUTES.md) - API 엔드포인트 문서
- [REDIS_ARCHITECTURE.md](file:///mnt/d/open-sam-backend/REDIS_ARCHITECTURE.md) - Redis 아키텍처
