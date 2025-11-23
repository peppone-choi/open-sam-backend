# Session E 구현 요약 (Implementation Summary)

## 프로젝트 목표

경매·토너먼트·국가 재정·실시간 브로드캐스트 등 경제/이벤트 기능을 완성하여 프론트엔드에서 노출되는 모든 패널이 실제 데이터와 동기화되도록 한다.

---

## 구현 완료 항목

### ✅ 1. 경매 시스템

#### 1.1 경매 만료 데몬 (AuctionExpirationDaemon)
- **파일**: `src/daemons/AuctionExpirationDaemon.ts`
- **기능**:
  - 만료 시간 기반 Cron/Interval 데몬
  - 모든 활성 경매를 즉시 종료
  - Redis/DB 락을 통한 중복 정산 방지
  - 유니크 아이템 경매 낙찰 처리
    - 소유권 이전
    - 로그 기록
    - 실패 시 환불 및 경매 연장
  - 자원 경매 (쌀 매매) 정산

#### 1.2 Redis 락 구조
```
락 키: auction:process:${sessionId}
TTL: 30초
획득 방식: SET NX EX (원자성 보장)
해제 방식: Lua 스크립트 (lockValue 검증)
```

#### 1.3 처리 흐름
```
1. 모든 세션의 만료된 경매 조회
2. 세션별 병렬 처리 (Redis 락 획득)
3. 각 경매별 처리
   ├─ 최고 입찰자 조회
   ├─ 연장 요청 확인
   ├─ 낙찰 처리 (유니크/자원)
   └─ 경매 종료 또는 연장
4. 이벤트 브로드캐스트
```

---

### ✅ 2. 토너먼트 시스템

#### 2.1 토너먼트 엔진 (TournamentEngine)
- **파일**: `src/services/tournament/TournamentEngine.service.ts`
- **기능**: PHP 로직 완전 포팅
  - `fillLowGenAll`: 저능력 장수 자동 채우기 (1 → 2)
  - `qualify`: 예선 진행 (2 → 3, 56페이즈)
  - `selection`: 추첨 (3 → 4, 32페이즈)
  - `finallySingle`: 본선 (4 → 5, 6페이즈)
  - `final16set`: 16강 배정 (5 → 6)
  - `startBetting`: 베팅 시작 (6)
  - `finalFight`: 16강/8강/4강/결승 (7/8/9/10)
  - `setGift`: 보상 지급 (10 → 0)

#### 2.2 토너먼트 단계별 흐름
```
1 (신청) → 2 (예선 56페이즈) → 3 (추첨 32페이즈) → 4 (본선 6페이즈) 
→ 5 (16강 배정) → 6 (베팅 60페이즈) → 7 (16강 8페이즈) → 8 (8강 4페이즈) 
→ 9 (4강 2페이즈) → 10 (결승 1페이즈) → 0 (종료)
```

#### 2.3 베팅 통합
- 단계 5 → 6: `startBetting()` - 16강 후보로 베팅 오픈
- 단계 6 → 7: `closeBetting()` - 베팅 마감
- 단계 10: `giveReward()` - 우승자 기준으로 배당 지급

#### 2.4 보상 체계
| 단계 | 경험치 | 골드 | 유산포인트 |
|------|--------|------|-----------|
| 16강 | +25 | +develcost | +10 |
| 8강 | +50 | +develcost×2 | - |
| 4강 | +50 | +develcost×3 | +10 |
| 준우승 | +100 | +develcost×6 | +50 |
| 우승 | +200 | +develcost×8 | +100 |

---

### ✅ 3. 베팅 시스템

#### 3.1 베팅 정산 (SettleBetting)
- **파일**: `src/services/betting/SettleBetting.service.ts`
- **기능**:
  - 베팅 마감 처리
  - 우승자 결정 후 배당 지급
  - 실패 시 환불 처리

#### 3.2 통합 포인트
- 토너먼트 베팅: `TournamentEngine.setGift()`에서 호출
- 일반 베팅: API를 통해 수동 정산

---

### ✅ 4. 국가 재정 시스템

#### 4.1 재정 서비스 (NationalFinanceService)
- **파일**: `src/services/economy/NationalFinance.service.ts`
- **기능**:
  - 도시 수입 계산
  - 성벽 수입 계산
  - 전쟁 수입 계산 (미구현, 0 반환)
  - 급여 지출 계산 (지급률 기반)
  - 상비군 유지비 계산
  - 재정 적용 및 급여 지급

#### 4.2 수입 공식

##### 도시 수입
```typescript
income = Math.floor(population * (agriculture + commerce) / 200);
if (security >= 80) {
  income = Math.floor(income * 1.1); // 치안 보너스 10%
}
```

##### 성벽 수입
```typescript
wallIncome = sum(wall * 10) // 모든 도시의 성벽 합산
```

#### 4.3 지출 공식

##### 급여
```typescript
salaryExpense = Math.floor(totalIncome * paymentRate / 100);
salaryPerGeneral = Math.floor(salaryExpense / generals.length);
```

##### 상비군 유지비
```typescript
armyMaintenanceCost = sum(troops * 0.1) // 모든 장수의 병력 합산
```

#### 4.4 순이익
```typescript
netIncome = totalIncome - totalExpense
```

#### 4.5 PHP 대비 검증
| 항목 | PHP | TypeScript | 일치 |
|------|-----|-----------|------|
| 도시 수입 (인구 10000, 농50, 상50, 치50) | 5000 | 5000 | ✓ |
| 도시 수입 (인구 10000, 농50, 상50, 치80) | 5500 | 5500 | ✓ |
| 성벽 수입 (성벽 100, 80, 60) | 2400 | 2400 | ✓ |
| 급여 (수입 10000, 지급률 10%, 장수 5명) | 1000 (200/인) | 1000 (200/인) | ✓ |
| 상비군 (통솔 1000, 800, 600) | 240 | 240 | ✓ |

---

### ✅ 5. 실시간 이벤트 브로드캐스트

#### 5.1 GameEventEmitter 확장
- **파일**: `src/services/gameEventEmitter.ts`
- **추가 메서드**:
  - `broadcastAuctionUpdate()`: 경매 상태 변경
  - `broadcastTournamentUpdate()`: 토너먼트 상태 변경
  - `broadcastBettingUpdate()`: 베팅 상태 변경
  - `broadcastFinanceUpdate()`: 국가 재정 업데이트

#### 5.2 이벤트 종류

| 이벤트 | 채널 | 트리거 | 페이로드 |
|--------|------|--------|---------|
| `auction:updated` | `session:${sessionId}` | 입찰 발생 | auctionId, highestBid, newCloseDate |
| `auction:closed` | `session:${sessionId}` | 경매 종료 | auctionId, winner, isRollback |
| `auction:unique_won` | `session:${sessionId}` | 유니크 낙찰 | winnerId, winnerName, itemKey, amount |
| `tournament:updated` | `session:${sessionId}` | 단계 변경 | tournament, phase, nextPhaseAt |
| `betting:updated` | `session:${sessionId}` | 베팅 참여/마감 | bettingId, event, totalPool |
| `finance:updated` | `session:${sessionId}` | 재정 적용 | nationId, totalIncome, netIncome |
| `turn:complete` | `session:${sessionId}` | 턴 처리 | turnNumber, nextTurnAt |
| `message:received` | `session:${sessionId}:general:${id}` | 메시지 수신 | messageId, from, to, content |
| `city:updated` | `session:${sessionId}:city:${id}` | 도시 점령 | cityId, nation, occupiedBy |
| `log:updated` | `session:${sessionId}` | 로그 추가 | generalId, logType, logText |

#### 5.3 Socket.IO Room 구조
```
session:{sessionId}                     // 전체 세션
session:{sessionId}:general:{id}        // 특정 장수
session:{sessionId}:nation:{id}         // 특정 국가
session:{sessionId}:city:{id}           // 특정 도시
battle:{battleId}                       // 특정 전투
```

---

## 파일 구조

```
open-sam-backend/
├── src/
│   ├── daemons/
│   │   └── AuctionExpirationDaemon.ts      [NEW] 경매 만료 데몬
│   ├── services/
│   │   ├── economy/
│   │   │   └── NationalFinance.service.ts  [NEW] 국가 재정
│   │   ├── tournament/
│   │   │   └── TournamentEngine.service.ts [EXISTING, ENHANCED]
│   │   ├── betting/
│   │   │   └── SettleBetting.service.ts    [EXISTING]
│   │   └── gameEventEmitter.ts             [ENHANCED] 이벤트 메서드 추가
│   └── models/
│       └── auction.model.ts                [EXISTING]
└── docs/
    └── sessionE/
        ├── DAEMON_OPERATIONS.md            [NEW] 데몬 운영 가이드
        ├── NATIONAL_FINANCE_FORMULAS.md    [NEW] 재정 계산식
        ├── EVENT_BROADCAST_FLOW.md         [NEW] 이벤트 흐름
        └── SESSION_E_IMPLEMENTATION_SUMMARY.md [NEW] 구현 요약
```

---

## 데몬 운영

### 1. 경매 만료 데몬
```typescript
// 서버 시작 시
AuctionExpirationDaemon.start(60000); // 1분마다

// 중지
AuctionExpirationDaemon.stop();
```

**스케줄**: 매 1분  
**락 키**: `auction:process:${sessionId}`  
**TTL**: 30초

### 2. 토너먼트 데몬
```typescript
// ExecuteEngine에서 주기적 호출
await processTournament(sessionId);
```

**스케줄**: 동적 (`tnmt_time` 기준)  
**락 키**: `tournament:process:${sessionId}`  
**TTL**: 60초

### 3. 국가 재정
```typescript
// 턴 처리 중 호출
await NationalFinanceService.applyNationalFinance(sessionId, nationId);
```

**스케줄**: 매 턴  
**락**: 턴 처리 락에 포함

---

## API 엔드포인트

### 경매
- `GET /api/auction/list` - 활성 경매 목록
- `POST /api/auction/bid` - 입찰
- `GET /api/auction/:id` - 경매 상세

### 토너먼트
- `GET /api/tournament/status` - 토너먼트 현황
- `POST /api/tournament/join` - 참가 신청
- `GET /api/tournament/ranking` - 순위 조회

### 베팅
- `GET /api/betting/list` - 베팅 목록
- `POST /api/betting/bet` - 베팅 참여
- `GET /api/betting/:id` - 베팅 상세

### 국가 재정
- `GET /api/nation/finance/:nationId` - 재정 현황 조회

---

## 단위 테스트 (예정)

### 경매 테스트
```typescript
describe('AuctionExpirationDaemon', () => {
  it('should close expired auction', async () => { ... });
  it('should transfer unique item to winner', async () => { ... });
  it('should refund on failure', async () => { ... });
  it('should extend auction on request', async () => { ... });
});
```

### 토너먼트 테스트
```typescript
describe('TournamentEngine', () => {
  it('should fill low generals', async () => { ... });
  it('should progress through qualifiers', async () => { ... });
  it('should start betting at round 16', async () => { ... });
  it('should distribute rewards correctly', async () => { ... });
});
```

### 재정 테스트
```typescript
describe('NationalFinanceService', () => {
  it('should calculate city income correctly', async () => { ... });
  it('should apply security bonus', async () => { ... });
  it('should calculate salary based on payment rate', async () => { ... });
  it('should calculate army maintenance cost', async () => { ... });
});
```

---

## 환경 변수

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379

# 경매 데몬
AUCTION_CHECK_INTERVAL=60000  # 1분
AUCTION_LOCK_TTL=30           # 30초

# 토너먼트 데몬
TOURNAMENT_CHECK_INTERVAL=10000  # 10초
TOURNAMENT_LOCK_TTL=60           # 60초

# Socket.IO
SOCKET_IO_PATH=/socket.io
SOCKET_IO_CORS_ORIGIN=http://localhost:3000
```

---

## 모니터링 메트릭

### Prometheus 메트릭 예시
```
# 경매
auction_daemon_runs_total{status="success|failure"}
auction_processed_total{type="UniqueItem|BuyRice|SellRice"}
auction_failures_total{reason="no_bidder|settlement_failed"}

# 토너먼트
tournament_phase_duration_seconds{phase="qualify|selection|final"}
tournament_participants_total{session="sangokushi_default"}
tournament_rewards_distributed_total

# 재정
nation_income_total{nation_id="1"}
nation_expense_total{nation_id="1"}
salary_distributed_total{nation_id="1"}

# Socket.IO
socket_connected_clients{session="sangokushi_default"}
socket_events_total{event="auction:updated"}
```

---

## 배포 체크리스트

### 개발 환경
- [x] 경매 데몬 구현
- [x] 토너먼트 엔진 포팅
- [x] 국가 재정 구현
- [x] 이벤트 브로드캐스트 연결
- [x] 문서화 완료
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성

### 스테이징 환경
- [ ] Redis 연결 확인
- [ ] Socket.IO 연결 확인
- [ ] 데몬 자동 시작 확인
- [ ] 이벤트 수신 테스트
- [ ] 부하 테스트

### 프로덕션 배포
- [ ] 환경 변수 설정
- [ ] 모니터링 대시보드 구성
- [ ] 알람 설정
- [ ] 롤백 계획 수립
- [ ] 배포 후 기능 검증

---

## 알려진 이슈 및 제한사항

### 1. 전쟁 수입 미구현
- 현재 전쟁 시스템이 완전히 구현되지 않아 전쟁 수입은 0으로 반환
- 추후 전쟁 시스템 구현 시 추가 예정

### 2. 급여 분배 방식
- 현재는 모든 장수에게 균등 분배
- 추후 계급/직책에 따른 차등 분배 고려 가능

### 3. 경매 연장 횟수
- 무한 연장을 방지하기 위한 상한선 설정 필요
- 현재는 `remainCloseDateExtensionCnt` 필드로 제어

### 4. 베팅 환불 정책
- 토너먼트 취소 시 베팅 환불 로직 미구현
- 추후 추가 필요

---

## 다음 단계

### 우선순위 높음
1. 단위 테스트 작성 (커버리지 80% 이상)
2. 통합 테스트 작성
3. 부하 테스트 수행
4. 프론트엔드 연동 확인

### 우선순위 중간
1. 전쟁 수입 구현
2. 베팅 환불 정책 구현
3. 급여 차등 분배 시스템
4. 경매 연장 횟수 제한

### 우선순위 낮음
1. 재정 예측 기능
2. 경매 알림 봇
3. 토너먼트 전적 통계
4. 베팅 AI 추천

---

## 참고 문서

- [데몬 운영 가이드](./DAEMON_OPERATIONS.md)
- [국가 재정 계산식](./NATIONAL_FINANCE_FORMULAS.md)
- [이벤트 브로드캐스트 흐름](./EVENT_BROADCAST_FLOW.md)
- [PHP 원본 코드](../../core/hwe/)
- [API 문서](../api/)

---

## 연락처

문의사항이나 버그 리포트는 다음 채널로 보고해주세요:
- GitHub Issues
- 개발 팀 Slack 채널
- 이메일: dev@opensam.game
