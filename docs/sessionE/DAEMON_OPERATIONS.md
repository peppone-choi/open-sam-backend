# 데몬 운영 가이드 (Daemon Operations Guide)

## 개요

Session E에서는 경매 만료, 토너먼트 진행 등을 자동으로 처리하는 데몬 시스템을 도입합니다.

---

## 1. 경매 만료 데몬 (AuctionExpirationDaemon)

### 목적
- 만료 시간이 지난 경매를 자동으로 종료
- 유니크 아이템/자원 경매의 낙찰 처리
- 실패 시 환불 처리

### 실행 주기
- **기본**: 매 1분 (60,000ms)
- **조정 가능**: 환경변수 `AUCTION_CHECK_INTERVAL` 설정

### Redis 락 구조

#### 락 키 (Lock Key)
```
auction:process:${sessionId}
```

#### 락 TTL (Time To Live)
- **30초**: 한 번의 처리가 30초 이상 걸리지 않는다고 가정
- 데드락 방지를 위한 자동 만료

#### 락 획득 로직
```typescript
const lockValue = `${Date.now()}_${Math.random()}`;
const acquired = await redis.set(lockKey, lockValue, 'EX', 30, 'NX');
```

#### 락 해제 로직
```lua
-- Lua 스크립트로 원자적 락 해제
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

### 처리 흐름

```
1. 모든 세션 조회
   └─> 활성 경매가 있는 세션만 필터링

2. 세션별 처리 (병렬)
   └─> Redis 락 획득
       ├─ 성공: 경매 처리
       │   ├─ 만료된 경매 조회
       │   ├─ 각 경매별 처리
       │   │   ├─ 최고 입찰자 조회
       │   │   ├─ 연장 요청 확인
       │   │   ├─ 낙찰 처리
       │   │   │   ├─ 유니크 아이템: 소유권 이전
       │   │   │   ├─ 자원 경매: 골드/쌀 교환
       │   │   │   └─ 실패 시: 환불 + 경매 연장
       │   │   └─ 경매 종료
       │   └─ 락 해제
       └─ 실패: 스킵 (다른 프로세스가 처리 중)

3. 결과 로그
   └─> 성공/실패 카운트 기록
```

### 중복 방지 전략

1. **Redis 분산 락**: 여러 서버에서 동시 실행 방지
2. **DB 트랜잭션**: 경매 상태 변경 시 원자성 보장
3. **낙관적 락**: `finished` 필드로 이미 처리된 경매 필터링

### 로그 키워드

| 레벨 | 키워드 | 설명 |
|------|--------|------|
| INFO | `[AuctionExpirationDaemon] Starting daemon` | 데몬 시작 |
| INFO | `[AuctionExpirationDaemon] Lock acquired` | 락 획득 성공 |
| INFO | `[AuctionExpirationDaemon] Auction finished successfully` | 낙찰 성공 |
| WARN | `[AuctionExpirationDaemon] Auction finish failed` | 낙찰 실패 |
| DEBUG | `[AuctionExpirationDaemon] Failed to acquire lock` | 락 획득 실패 (정상) |
| ERROR | `[AuctionExpirationDaemon] Error processing auction` | 처리 중 에러 |

### 모니터링 지표

```typescript
// 프로메테우스 메트릭 예시
auction_daemon_runs_total{status="success|failure"} // 실행 횟수
auction_daemon_duration_seconds // 실행 시간
auction_processed_total{type="UniqueItem|BuyRice|SellRice"} // 처리된 경매 수
auction_failures_total{reason="no_bidder|settlement_failed"} // 실패 카운트
```

### 시작/중지 방법

#### 서버 시작 시 자동 실행
```typescript
// server.ts
import { AuctionExpirationDaemon } from './daemons/AuctionExpirationDaemon';

// 서버 시작 후
AuctionExpirationDaemon.start(60000); // 1분마다
```

#### 수동 중지
```typescript
AuctionExpirationDaemon.stop();
```

---

## 2. 토너먼트 데몬 (TournamentDaemon)

### 목적
- 토너먼트 단계를 자동으로 진행
- 예선 → 추첨 → 본선 → 결승 → 보상

### 실행 주기
- **동적**: `tnmt_time` 기준으로 다음 실행 시간 계산
- **기본 단위**: `calcTournamentTerm(turnTerm)` (5~120초)

### 처리 흐름

```
processTournament(sessionId)
├─ tnmt_auto === false → 종료
├─ now < tnmt_time → 대기
└─ tournament 상태별 처리
    ├─ 1: 신청 마감 → fillLowGenAll() → 2로 전환
    ├─ 2: 예선 (56페이즈) → qualify() → 3으로 전환
    ├─ 3: 추첨 (32페이즈) → selection() → 4로 전환
    ├─ 4: 본선 (6페이즈) → finallySingle() → 5로 전환
    ├─ 5: 16강 배정 → final16set() → 6으로 전환
    ├─ 6: 베팅 (60페이즈, 최대 1시간) → closeBetting() → 7로 전환
    ├─ 7: 16강 (8페이즈) → finalFight(16) → 8로 전환
    ├─ 8: 8강 (4페이즈) → finalFight(8) → 9로 전환
    ├─ 9: 4강 (2페이즈) → finalFight(4) → 10으로 전환
    └─ 10: 결승 (1페이즈) → finalFight(2) + setGift() → 0으로 전환
```

### Redis 락 구조

#### 락 키
```
tournament:process:${sessionId}
```

#### 락 TTL
- **60초**: 토너먼트 처리는 복잡하므로 더 긴 시간 허용

### 베팅 통합

#### 베팅 시작 (단계 5 → 6)
```typescript
async function startBetting(sessionId: string, type: number, unit: number) {
  // 1. 베팅 생성
  const bettingID = await Betting.genNextBettingID(sessionId);
  
  // 2. 16강 후보 조회
  const candidates = await Tournament.find({
    session_id: sessionId,
    grp: { $gte: 20, $lt: 30 }
  });
  
  // 3. 베팅 오픈
  await Betting.openBetting(sessionId, {
    id: bettingID,
    type: 'tournament',
    name: typeText, // '전력전', '통솔전', ...
    candidates: { ... },
    closeYearMonth: openYearMonth + 120
  });
  
  // 4. NPC 자동 베팅
  for (const npc of npcList) {
    await betting.bet(npc.no, null, [target], betGold);
  }
  
  // 5. 이벤트 브로드캐스트
  GameEventEmitter.broadcastBettingUpdate(sessionId, bettingID, {
    opened: true
  });
}
```

#### 베팅 종료 (단계 6 → 7)
```typescript
async function closeBetting(bettingId: number) {
  const betting = new Betting(sessionId, bettingId);
  await betting.closeBetting(); // 베팅 마감
  // 우승자는 결승 후 결정되므로 여기선 마감만
}
```

#### 보상 지급 (단계 10)
```typescript
async function setGift() {
  // 1. 우승자 조회
  const winner = await Tournament.findOne({
    session_id: sessionId,
    grp: { $gte: 60 },
    win: { $gt: 0 }
  });
  
  // 2. 베팅 보상 지급
  const bettingId = await gameStor.getValue('last_tournament_betting_id');
  const betting = new Betting(sessionId, bettingId);
  await betting.giveReward([winner.no]);
  
  // 3. 토너먼트 보상 지급
  // 16강: experience +25, gold +develcost
  // 8강: experience +50, gold +develcost*2
  // 4강: experience +50, gold +develcost*3, inheritPoint +10
  // 준우승: experience +100, gold +develcost*6, inheritPoint +50
  // 우승: experience +200, gold +develcost*8, inheritPoint +100
}
```

---

## 3. 국가 재정 데몬

### 목적
- 매 턴마다 국가 재정 계산 및 적용
- 급여 지급

### 실행 시점
- **턴 엔진 내부**: `ExecuteEngine.service.ts`의 턴 처리 중 호출

### 처리 흐름

```
NationalFinanceService.applyNationalFinance(sessionId, nationId)
├─ 1. 수입 계산
│   ├─ 도시 수입: population * (agriculture + commerce) / 200
│   │   └─ 치안 보너스: security >= 80 ? +10%
│   ├─ 성벽 수입: sum(wall * 10)
│   └─ 전쟁 수입: (미구현)
│
├─ 2. 지출 계산
│   ├─ 급여: totalIncome * paymentRate / 100
│   └─ 상비군 유지비: sum(troops * 0.1)
│
├─ 3. 재정 적용
│   ├─ 국가 금고 업데이트: gold += netIncome
│   └─ 급여 지급: 장수들에게 균등 분배
│
└─ 4. 이벤트 브로드캐스트
    └─ GameEventEmitter.broadcastFinanceUpdate()
```

---

## 4. 환경 변수 설정

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379

# 경매 데몬 설정
AUCTION_CHECK_INTERVAL=60000  # 1분 (밀리초)
AUCTION_LOCK_TTL=30           # 30초

# 토너먼트 데몬 설정
TOURNAMENT_CHECK_INTERVAL=10000  # 10초
TOURNAMENT_LOCK_TTL=60           # 60초
```

---

## 5. 에러 핸들링

### 재시도 전략
1. **경매 데몬**: 실패 시 다음 주기에 자동 재시도
2. **토너먼트 데몬**: 실패 시 로그 기록 후 스킵
3. **재정 데몬**: 턴 처리 중이므로 재시도 없음 (로그 기록)

### 알람 조건
- 연속 3회 이상 실패
- 락 획득 실패율 > 50%
- 처리 시간 > 30초

---

## 6. 성능 최적화

### 데이터베이스 인덱스
```javascript
// auctions
{ session_id: 1, finished: 1, closeDate: 1 }
{ session_id: 1, type: 1, finished: 1 }

// tournament
{ session_id: 1, grp: 1, grp_no: 1 }
{ session_id: 1, prmt: 1 }

// betting
{ session_id: 1, finished: 1 }
```

### Redis 연결 풀
- **최소 연결**: 2
- **최대 연결**: 10
- **재시도**: 3회

---

## 7. 테스트 방법

### 단위 테스트
```bash
npm test -- AuctionExpirationDaemon.test.ts
npm test -- TournamentEngine.test.ts
npm test -- NationalFinance.test.ts
```

### 통합 테스트
```bash
npm run test:integration
```

### 수동 테스트
```typescript
// 경매 만료 즉시 처리
await AuctionExpirationDaemon.processSession('sangokushi_default');

// 토너먼트 단계 진행
await processTournament('sangokushi_default');

// 재정 계산
const finance = await NationalFinanceService.getNationalFinance('sangokushi_default', 1);
console.log(finance);
```

---

## 8. 장애 대응

### 락 데드락
```bash
# Redis CLI로 락 강제 해제
redis-cli DEL "auction:process:sangokushi_default"
redis-cli DEL "tournament:process:sangokushi_default"
```

### 데몬 재시작
```bash
# PM2 사용 시
pm2 restart api

# Docker 사용 시
docker-compose restart api
```

### 수동 복구
```typescript
// 특정 경매 수동 종료
const auction = await Auction.findById(auctionId);
await AuctionExpirationDaemon.processAuction(sessionId, auction);

// 토너먼트 상태 초기화
await KVStorage.getStorage(`game_env:${sessionId}`).setValue('tournament', 0);
```

---

## 9. 모니터링 대시보드

### 그라파나 패널 예시

#### 경매 데몬
- 실행 횟수 (시간당)
- 처리된 경매 수 (타입별)
- 평균 처리 시간
- 실패율

#### 토너먼트 데몬
- 현재 단계 분포
- 베팅 참여율
- 상금 지급 통계

#### 재정 시스템
- 국가별 순이익
- 급여 지급 총액
- 상비군 유지비

---

## 10. 운영 체크리스트

### 일일 점검
- [ ] 경매 데몬 정상 작동 확인
- [ ] 토너먼트 진행 상태 확인
- [ ] 에러 로그 확인

### 주간 점검
- [ ] 데몬 성능 지표 리뷰
- [ ] 락 타임아웃 발생 여부 확인
- [ ] DB 인덱스 최적화 필요 여부 검토

### 월간 점검
- [ ] 재정 밸런스 검토
- [ ] 경매/토너먼트 참여율 분석
- [ ] 시스템 부하 테스트
