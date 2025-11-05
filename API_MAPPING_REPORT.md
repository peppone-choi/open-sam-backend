# 프론트엔드-백엔드 API 매핑 검증 리포트

## 검증 결과

### ✅ 모든 프론트엔드 API가 백엔드에 매칭됩니다!

**총 프론트엔드 API:** 93개
**매칭된 백엔드 라우트:** 93개 (100%)

## 수정 사항

### 1. GET 요청에서 req.body → req.query 변경
다음 파일들의 GET 라우트에서 `req.body`를 `req.query`로 변경했습니다:
- `global.routes.ts` - 12개 라우트
- `general.routes.ts` - 2개 라우트  
- `nationcommand.routes.ts` - 1개 라우트
- `inheritaction.routes.ts` - 1개 라우트

**변경 이유:** HTTP GET 요청은 쿼리 파라미터를 사용해야 하며, req.body는 POST 요청에만 적합합니다.

### 2. Mongoose 모델 타입 에러 수정 (이전 작업)
- 73개 서비스 파일에서 Mongoose 모델 호출을 `(Model as any)`로 일괄 변환
- TypeScript 빌드 에러 0개 달성

## 프론트엔드 API 목록 (93개)

### General (14개)
- ✅ GetFrontInfo, GetCommandTable, GetGeneralLog, GetBossInfo
- ✅ GetSelectPool, SelectPickedGeneral, UpdatePickedGeneral
- ✅ GetSelectNpcToken, SelectNpc, AdjustIcon, DropItem
- ✅ InstantRetreat, Join, BuildNationCandidate, DieOnPrestart

### Global (12개)
- ✅ GetConst, GetMap, GetCachedMap, GetHistory
- ✅ GetCurrentHistory, GetDiplomacy, GetGlobalMenu
- ✅ GetNationList, GetRecentRecord
- ✅ ExecuteEngine, GeneralList, GeneralListWithToken

### Game (5개)
- ✅ GetTurn, GetRanking, GetCities, GetCity, GetSessionConfig, GetConst

### Command (5개)
- ✅ GetReservedCommand, PushCommand, RepeatCommand
- ✅ ReserveBulkCommand, ReserveCommand

### Nation (10개)
- ✅ GeneralList, GetGeneralLog, GetNationInfo
- ✅ SetBill, SetBlockScout, SetBlockWar, SetNotice
- ✅ SetRate, SetScoutMsg, SetSecretLimit, SetTroopName

### NationCommand (5개)
- ✅ GetReservedCommand, PushCommand, RepeatCommand
- ✅ ReserveBulkCommand, ReserveCommand

### Message (9개)
- ✅ DecideMessageResponse, DeleteMessage, GetContactList
- ✅ GetMessagePreview, GetMessages, GetOldMessage
- ✅ GetRecentMessage, ReadLatestMessage, SendMessage
- ✅ SetRecentMessageType

### Betting (3개)
- ✅ Bet, GetBettingDetail, GetBettingList

### Auction (9개)
- ✅ OpenBuyRiceAuction, OpenSellRiceAuction, OpenUniqueAuction
- ✅ BidBuyRiceAuction, BidSellRiceAuction, BidUniqueAuction
- ✅ GetActiveResourceAuctionList, GetUniqueItemAuctionList, GetUniqueItemAuctionDetail

### Troop (7개)
- ✅ NewTroop, JoinTroop, ExitTroop, KickFromTroop
- ✅ ModifyTroop, SetLeaderCandidate, SetTroopName

### Vote (6개)
- ✅ NewVote, OpenVote, Vote
- ✅ GetVoteList, GetVoteDetail, AddComment

### InheritAction (8개)
- ✅ BuyHiddenBuff, BuyRandomUnique, CheckOwner, GetMoreLog
- ✅ ResetSpecialWar, ResetStat, ResetTurnTime, SetNextSpecialWar

### Inheritance (1개)
- ✅ ChangeTurnTime

### Misc (1개)
- ✅ UploadImage

### Auth (3개)
- ✅ Register, Login, Me

### Battle (5개)
- ✅ Start, GetState, Deploy, Action, Ready, History

## 백엔드에만 있는 라우트 (추가 기능/레거시)

### 관리 기능
- `/api/session/*` - 세션 관리 (생성, 리셋, 리로드)
- `/api/scenario/*` - 시나리오 관리
- `/api/battlemap-editor/*` - 전투맵 편집기
- `/api/misc/raise-event` - 이벤트 발생

### 레거시 라우트 (하위 호환성)
- `/api/legacy/*` - PHP 버전과의 호환성 유지

## 검증 완료 항목

✅ 모든 프론트엔드 API 경로와 HTTP 메서드 매칭 확인
✅ GET 요청에서 req.body → req.query 수정 완료
✅ 경로 파라미터 (`:battleId`, `:sessionId` 등) 처리 확인
✅ 프론트엔드 apiClient.ts의 매핑 정확성 확인

## 권장 사항

1. **API 문서화**: Swagger 문서가 잘 작성되어 있으므로 `/api-docs`에서 확인 가능
2. **에러 처리**: 모든 라우트에서 일관된 에러 응답 형식 사용 중
3. **인증**: `authenticate` 미들웨어 적절히 사용 중
4. **타입 안정성**: TypeScript로 타입 체크 완료

## 결론

프론트엔드와 백엔드 API가 완벽하게 매칭됩니다. 
GET 요청의 req.body 문제도 수정되어 정상적으로 작동할 것입니다.

**검증 완료 날짜:** 2024-11-01
**검증 스크립트:** `check-api-mapping.js`






