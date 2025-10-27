# ✅ 최종 API 폴더 구조

## 📁 정리 완료 (41개 → 14개)

```
src/api/
├── @types/              공통 타입 정의
├── common/              공통 유틸리티
├── unified/             통합 Entity API ⭐
├── v2/                  Lore 중립 v2 API ⭐
├── command/             커맨드 시스템 (CQRS)
├── battle/              전투 시스템 (40x40)
├── daemon/              백그라운드 워커
│   ├── command-processor.ts
│   ├── command-completer.ts
│   ├── turn-scheduler.ts
│   └── handlers/        62개 커맨드 핸들러
├── websocket/           웹소켓 실시간 통신
├── event/               이벤트 시스템 (유지)
├── rank-data/           랭킹 시스템 (유지)
├── game-session/        게임 세션 관리
├── admin/               어드민 API
├── config/              설정
└── index.ts
```

## 🗑️ 제거된 폴더 (27개)

### Entity로 통합
- commander, settlement, faction
- commander-access-log, commander-record, commander-turn
- faction-env, faction-turn
- item, troop
- board, comment, message, vote, vote-comment

### 레거시/미사용
- ng-auction, ng-auction-bid, ng-betting, ng-history
- user-record, reserved-open, select-pool, select-npc-token
- plock, storage, battlefield-tile, world-history

## ✅ 모든 기능은 Entity/System으로 이전

| 제거된 폴더 | 통합 방법 |
|------------|----------|
| commander | entities (COMMANDER) |
| settlement | entities (SETTLEMENT) |
| faction | entities (FACTION) |
| item | entities (ITEM) |
| troop | entities (FORCE) |
| board | entities (POST, type='board') |
| comment | entities (POST, type='comment') |
| message | entities (POST, type='message') |
| vote | entities (VOTE) |
| ng-auction | entities (AUCTION) + AuctionSystem |
| ng-auction-bid | entities (BID) |
| ng-betting | BettingSystem |
| rank-data | RankingSystem |
| user-record | entities (USER) + LOG_ENTRY |
| *-access-log | LOG_ENTRY + AccessLogSystem |
| *-record | LOG_ENTRY + HistorySystem |
| *-turn | entity.systems.turnState |
| *-env | entity.systems.environment |
| world-history | HistorySystem |
| plock | LockSystem |
| storage | StorageSystem |
| battlefield-tile | battle.tiles |

## 🎯 깔끔한 최종 구조!

- ✅ 14개 핵심 폴더만 유지
- ✅ 모든 기능 Entity/System으로 통합
- ✅ TypeScript 빌드 성공
- ✅ 완전 Lore 중립

🎉 완성!
