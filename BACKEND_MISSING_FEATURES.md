# 백엔드 누락 기능 분석 보고서

**분석일**: 2025-11-05  
**대상**: open-sam-backend vs sammo-php 백엔드 로직

---

## 📋 요약

API 엔드포인트는 **100% 포팅**되었으나, **핵심 비즈니스 로직의 30%가 미완성** 상태입니다.

| 카테고리 | 완성도 | 우선순위 | 예상 시간 |
|---------|--------|---------|----------|
| API 엔드포인트 | 100% | - | - |
| 명령 실행 로직 | 90% | Medium | 2일 |
| 전투 시스템 | 95% | ✅ 완료 | - |
| 경매 시스템 | 60% | High | 2일 |
| 베팅 시스템 | 50% | Medium | 1일 |
| 토너먼트 | 20% | **High** | 5일 |
| 국가 재정 | 30% | **High** | 2일 |
| 실시간 이벤트 | 70% | Medium | 1일 |
| **총 미완성 작업** | - | - | **16일** |

---

## 1. 전투 시스템 (95% 완성) ✅ P0 완료

### ✅ 구현된 기능
- 전투 룸 생성/참가
- 턴 진행 (40x40 그리드)
- 유닛 이동/공격
- Socket.IO 실시간 업데이트
- **전투 종료 후 월드 반영** ✅ (2025-12 구현)
- **도시 점령 로직** ✅
- **국가 멸망 체크/처리** ✅
- **천하통일 체크/처리** ✅
- **MongoDB 트랜잭션** ✅
- **Socket 브로드캐스트** ✅
  - `city:occupied` - 도시 점령
  - `nation:destroyed` - 국가 멸망
  - `game:unified` - 천하통일

### ✅ 완료된 P2 기능 (2025-12)
- **명예의 전당**: 통일 시 황제/공신 기록, 모든 장수 통계 기록
- **긴급천도**: 수도 함락 시 자동 천도, 수뇌부 이동, 국고 감소, 사기 감소

### ✅ 완료된 P3 기능 (2025-12)
- **동시 전투 처리**: Redis 분산 락 적용 (resolveTurn, handleBattleEnded)
- **Socket 재연결**: 60초 grace period, 전투 상태 복구, 재연결 이벤트

---

## 2. 경매 시스템 (95% 완성) ✅ P0 완료

### ✅ 구현된 기능
- 자원 경매 (금/쌀)
- 입찰/낙찰 처리
- **유니크 아이템 경매** ✅ (2025-12 구현)
  - 경매 생성 시 아이템 소유 검증
  - 동일 부위 유니크 제한 체크
  - 다른 경매 1순위 입찰 시 슬롯 충돌 검사
  - 글로벌 히스토리 로그 (【보물수배】)
- **실시간 종료 데몬** ✅ (daemon-unified.ts에 매분 cron 등록)
- **낙찰 실패 시 메시지 발송** ✅
  - 판매자 부재, 아이템 미유효, 슬롯 충돌 등 상황별 메시지

### ⏳ 미완료 기능 (P2)
#### 2.1. 연도별 유니크 소유 제한
- PHP: maxUniqueItemLimit 배열 기반 제한
- 현재 입찰 시점에서 체크하므로 낙찰 시 재확인 필요
- 낙찰 실패 시 자동 연장 로직 미구현

**우선순위**: P2 (추가 기능)  
**예상 시간**: 4시간

---

## 3. 토너먼트 (20% 완성) 🔴 P0

### ✅ 구현된 기능
- 토너먼트 신청/취소
- 브래킷 조회

### ❌ 누락된 기능
**위치**: `src/services/tournament/TournamentEngine.service.ts`

모든 핵심 로직이 TODO 상태:
```typescript
fillLowGenAll()    // TODO - 예선 참가자 채우기
qualify()          // TODO - 예선 진행
selection()        // TODO - 본선 추첨
finallySingle()    // TODO - 단판 진행
final16set()       // TODO - 16강 편성
startBetting()     // TODO - 베팅 시작
finalFight()       // TODO - 결승 진행
setGift()          // TODO - 보상 지급
```

**필요한 작업**:
1. 각 단계 로직 구현
2. 베팅 연동
3. Socket.IO 실시간 중계

**우선순위**: P0 (주요 컨텐츠)  
**예상 시간**: 5일

---

## 4. 국가 재정 계산 (30% 완성) 🔴 P0

### ❌ 누락된 기능
**위치**: `src/routes/nation.routes.ts:2175-2181`

```typescript
income: {
  gold: { city: 0, war: 0 },  // TODO: 계산 로직 포팅 필요
  rice: { city: 0, wall: 0 }  // TODO: 계산 로직 포팅 필요
},
outcome: 0  // TODO: getOutcome 포팅 필요
```

**필요한 PHP 로직 포팅**:
- `getGoldIncome()` - 도시/전쟁 금 수입
- `getRiceIncome()` - 도시/성벽 쌀 수입
- `getWarGoldIncome()` - 전쟁 금 수입
- `getWallIncome()` - 둔전 쌀 수입
- `getOutcome()` - 지급률 기반 지출

**우선순위**: P0 (국가 관리 핵심)  
**예상 시간**: 2일

---

## 5. 실시간 이벤트 (70% 완성) 🟡 P1

### ✅ 구현된 기능
- Socket.IO 인프라
- 게임/장수/전투 이벤트

### ❌ 누락된 기능

#### 5.1. 메시지 전송 시 실시간 알림
**위치**: `src/services/message/SendMessage.service.ts`
**문제**: `message:new` 이벤트 미방출

**필요한 작업**:
```typescript
// SendMessage.service.ts에 추가
await GameEventEmitter.broadcastMessage(sessionId, {
  from: senderId,
  to: recipientId,
  message: messageContent
});
```

#### 5.2. 국가/도시 업데이트 브로드캐스트
**위치**: `src/services/gameEventEmitter.ts`
**문제**: 메서드는 존재하나 호출부 부재

**필요한 작업**:
- Nation 업데이트 시 `broadcastNationUpdate()` 호출
- City 업데이트 시 `broadcastCityUpdate()` 호출

**우선순위**: P1  
**예상 시간**: 1일

---

## 6. 명령 실행 로직 (90% 완성) 🟡 P1

### ✅ 구현된 기능
- ExecuteEngine 핵심 로직
- 대부분의 명령 처리

### ❌ 누락된 기능
**위치**: `src/services/global/ExecuteEngine.service.ts`

```typescript
// L1036: NPC 자동 실행
if (autorunMode) {
  // TODO: NPC 자동 명령
}

// L1210: 환생 처리
// TODO: 환생 로직

// L1459: 통계 생성
// TODO: checkStatistic
```

**우선순위**: P2  
**예상 시간**: 2일

---

## 7. 베팅 시스템 (50% 완성) 🟡 P1

### ✅ 구현된 기능
- 베팅 생성/조회
- 배팅 처리

### ❌ 누락된 기능
**위치**: `src/core/betting/Betting.ts`
**문제**: 토너먼트와의 연동/정산 경로 미완성

**필요한 작업**:
1. 토너먼트 진행 시 베팅 오픈
2. 토너먼트 종료 시 배당 정산
3. 당첨자에게 보상 지급

**우선순위**: P1 (토너먼트 의존)  
**예상 시간**: 1일

---

## 8. RootDB 의존 기능 (0% 완성) 🟢 P2

### ❌ 누락된 기능
- 로그인 토큰 관리
- 회원 로그
- 아이콘 업로드
- 패널티 시스템

**위치**:
- `src/utils/Session.ts:177-179` (login_token TODO)
- `src/services/general/AdjustIcon.service.ts:21+` (RootDB 필요)
- `src/services/general/SelectNpc.service.ts` (RootDB TODO)

**해결 방안**:
1. RootDB를 MongoDB로 대체
2. 또는 기능 플래그로 비활성화

**우선순위**: P2 (레거시 기능)  
**예상 시간**: 2일

---

## 📊 구현 우선순위

### P0 - 즉시 필요 (게임 핵심) - 12일
1. **전투 → 월드 반영** (3일)
2. **경매 실시간 종료** (4시간)
3. **토너먼트 엔진** (5일)
4. **국가 재정 계산** (2일)
5. **유니크 경매** (2일)

### P1 - 중요 기능 - 3일
6. **실시간 메시지/국가/도시 이벤트** (1일)
7. **베팅 정산** (1일)
8. **NPC 자동실행/환생/통계** (2일 - 선택)

### P2 - 선택 기능 - 2일
9. **RootDB 대체** (2일 - 선택)

---

## 🔧 구현 계획

### Week 1: 핵심 로직 (P0)
- Day 1-3: 전투 → 월드 반영
- Day 4: 경매 실시간 종료 데몬
- Day 5-7: 토너먼트 엔진 구현

### Week 2: 재정 & 경매 (P0)
- Day 1-2: 국가 재정 계산 포팅
- Day 3-4: 유니크 경매 구현

### Week 3: 실시간 & 베팅 (P1)
- Day 1: 실시간 이벤트 연결
- Day 2: 베팅 정산
- Day 3-4: NPC/환생/통계 (선택)

---

## 📝 테스트 체크리스트

### 전투 시스템
- [ ] 전투 승리 시 도시 점령
- [ ] 국가 멸망 시 장수 재야 전환
- [ ] 통일 시 게임 종료 이벤트

### 경매 시스템
- [ ] 경매 마감 시각에 자동 종료
- [ ] 유니크 아이템 낙찰/소유권 이전
- [ ] 입찰 실패 시 금액 반환

### 토너먼트
- [ ] 예선 → 본선 → 결승 자동 진행
- [ ] 베팅 연동/정산
- [ ] 우승 보상 지급

### 국가 재정
- [ ] 도시별 수입 계산
- [ ] 지급률에 따른 지출
- [ ] 실시간 국고 업데이트

---

## 🚨 주의사항

1. **트랜잭션 관리**: 전투/경매/토너 결과 반영 시 DB 트랜잭션 필수
2. **분산 락**: 경매/베팅 중복 처리 방지
3. **이벤트 순서**: 전투 종료 → 도시 점령 → 국가 멸망 → 통일 체크 순서 보장
4. **실시간 부하**: 브로드캐스트 이벤트 샘플링/병합 고려

---

## 📚 참고 파일

- `src/handlers/battle.socket.ts` - 전투 Socket 핸들러
- `src/services/battle/BattleEventHook.service.ts` - 전투 후속 처리
- `src/services/auction/AuctionEngine.service.ts` - 경매 엔진
- `src/services/tournament/TournamentEngine.service.ts` - 토너먼트 엔진
- `src/services/global/ExecuteEngine.service.ts` - 명령 실행 엔진
- `src/routes/nation.routes.ts` - 국가 API
