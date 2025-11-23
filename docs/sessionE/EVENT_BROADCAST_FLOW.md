# 이벤트 브로드캐스트 흐름 (Event Broadcast Flow)

## 개요

게임 내 주요 이벤트 발생 시 Socket.IO를 통해 실시간으로 프론트엔드에 알림을 전송합니다.

---

## 1. 아키텍처

```
┌─────────────────┐
│  Game Service   │
│  (Backend)      │
└────────┬────────┘
         │ 1. Event 발생
         ▼
┌─────────────────┐
│ GameEventEmitter│
│  (Abstraction)  │
└────────┬────────┘
         │ 2. Socket Manager 호출
         ▼
┌─────────────────┐
│ SocketManager   │
│  (Socket.IO)    │
└────────┬────────┘
         │ 3. Room별 브로드캐스트
         ▼
┌─────────────────┐
│  Frontend       │
│  (Listener)     │
└─────────────────┘
```

---

## 2. 이벤트 종류별 흐름

### 2.1 경매 이벤트

#### 경매 시작
```typescript
// Trigger
await AuctionService.openUniqueAuction(itemKey, startAmount);

// Payload
GameEventEmitter.broadcastAuctionUpdate(sessionId, auctionId, {
  event: 'opened',
  type: 'UniqueItem',
  itemKey: 'weapon_QingLongYanYueDao',
  startAmount: 100,
  closeDate: '2025-11-23T15:00:00.000Z'
});

// Channel
`session:${sessionId}` → `auction:updated`
```

#### 입찰 발생
```typescript
// Trigger
await AuctionService.bidUniqueAuction(auctionId, amount);

// Payload
GameEventEmitter.broadcastAuctionUpdate(sessionId, auctionId, {
  event: 'bid_placed',
  highestBid: {
    generalId: 123,
    generalName: '관우',
    amount: 150
  },
  newCloseDate: '2025-11-23T15:05:00.000Z' // 연장된 경우
});

// Channel
`session:${sessionId}` → `auction:updated`
```

#### 경매 종료
```typescript
// Trigger
await AuctionExpirationDaemon.closeAuction(auction);

// Payload
GameEventEmitter.broadcastGameEvent(sessionId, 'auction:closed', {
  auctionId: auction._id,
  isRollback: false,
  winner: {
    generalId: 123,
    generalName: '관우',
    amount: 200
  }
});

// Channel
`session:${sessionId}` → `auction:closed`
```

#### 유니크 아이템 낙찰
```typescript
// Trigger
await AuctionExpirationDaemon.finishUniqueItemAuction(auction, bid);

// Payload
GameEventEmitter.broadcastGameEvent(sessionId, 'auction:unique_won', {
  auctionId: auction._id,
  winnerId: 123,
  winnerName: '관우',
  itemKey: 'weapon_QingLongYanYueDao',
  amount: 200
});

// Channel
`session:${sessionId}` → `auction:unique_won`
```

---

### 2.2 토너먼트 이벤트

#### 토너먼트 시작
```typescript
// Trigger
await TournamentService.startTournament(type);

// Payload
GameEventEmitter.broadcastTournamentUpdate(sessionId, {
  event: 'started',
  type: 'leadership', // 'total', 'leadership', 'strength', 'intel'
  tournament: 1,
  phase: 0,
  nextPhaseAt: '2025-11-23T15:05:00.000Z'
});

// Channel
`session:${sessionId}` → `tournament:updated`
```

#### 토너먼트 단계 진행
```typescript
// Trigger
await TournamentEngine.processTournament(sessionId);

// Payload
GameEventEmitter.broadcastTournamentUpdate(sessionId, {
  event: 'phase_changed',
  tournament: 2, // 예선
  phase: 10,
  nextPhaseAt: '2025-11-23T15:10:00.000Z'
});

// Channel
`session:${sessionId}` → `tournament:updated`
```

#### 베팅 시작
```typescript
// Trigger
await TournamentEngine.startBetting(sessionId, type, unit);

// Payload
GameEventEmitter.broadcastBettingUpdate(sessionId, bettingId, {
  event: 'opened',
  type: 'tournament',
  name: '통솔전',
  candidates: {
    123: { title: '관우', info: '통솔: 95' },
    124: { title: '장비', info: '통솔: 92' }
  },
  closeYearMonth: 25112
});

// Channel
`session:${sessionId}` → `betting:updated`
```

#### 토너먼트 종료 및 보상
```typescript
// Trigger
await TournamentEngine.setGift(sessionId, type);

// Payload
GameEventEmitter.broadcastTournamentUpdate(sessionId, {
  event: 'finished',
  winner: {
    no: 123,
    name: '관우'
  },
  runnerUp: {
    no: 124,
    name: '장비'
  },
  rewards: {
    winner: { gold: 800, experience: 200, inheritPoint: 100 },
    runnerUp: { gold: 600, experience: 100, inheritPoint: 50 }
  }
});

// Channel
`session:${sessionId}` → `tournament:updated`
```

---

### 2.3 베팅 이벤트

#### 베팅 참여
```typescript
// Trigger
await BettingService.bet(generalNo, targets, amount);

// Payload
GameEventEmitter.broadcastBettingUpdate(sessionId, bettingId, {
  event: 'bet_placed',
  generalId: 123,
  generalName: '관우',
  targets: [456], // 베팅한 후보 ID
  amount: 1000,
  totalPool: 15000
});

// Channel
`session:${sessionId}` → `betting:updated`
```

#### 베팅 마감
```typescript
// Trigger
await Betting.closeBetting();

// Payload
GameEventEmitter.broadcastBettingUpdate(sessionId, bettingId, {
  event: 'closed',
  totalPool: 50000,
  participantCount: 25
});

// Channel
`session:${sessionId}` → `betting:updated`
```

#### 배당 지급
```typescript
// Trigger
await Betting.giveReward(winners);

// Payload
GameEventEmitter.broadcastBettingUpdate(sessionId, bettingId, {
  event: 'reward_distributed',
  winners: [456],
  winnerCount: 8,
  totalReward: 50000,
  rewardPerWinner: 6250
});

// Channel
`session:${sessionId}` → `betting:updated`
```

---

### 2.4 국가 재정 이벤트

#### 턴 처리 시 재정 적용
```typescript
// Trigger
await NationalFinanceService.applyNationalFinance(sessionId, nationId);

// Payload
GameEventEmitter.broadcastFinanceUpdate(sessionId, nationId, {
  totalIncome: 12400,
  totalExpense: 2100,
  netIncome: 10300,
  newGold: 60300,
  salaryDistributed: 1860
});

// Channel
`session:${sessionId}` → `finance:updated`
```

---

### 2.5 장수 업데이트 이벤트

#### 장수 정보 변경
```typescript
// Trigger
await GeneralService.updateGeneral(generalId, updates);

// Payload
GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, {
  gold: 5000,
  rice: 10000,
  leadership: 95,
  itemAcquired: 'weapon_QingLongYanYueDao'
});

// Channel
`session:${sessionId}:general:${generalId}` → `general:updated`
```

---

### 2.6 국가 업데이트 이벤트

#### 국가 정보 변경
```typescript
// Trigger
await NationService.updateNation(nationId, updates);

// Payload
GameEventEmitter.broadcastNationUpdate(sessionId, nationId, {
  gold: 100000,
  rice: 500000,
  paymentRate: 15
});

// Channel
`session:${sessionId}:nation:${nationId}` → `nation:updated`
```

---

### 2.7 도시 업데이트 이벤트

#### 도시 점령
```typescript
// Trigger
await CityService.occupyCity(cityId, nationId);

// Payload
GameEventEmitter.broadcastCityUpdate(sessionId, cityId, {
  nation: 2,
  population: 8000,
  agriculture: 50,
  commerce: 60,
  occupiedBy: '위',
  occupiedAt: '2025-11-23T15:00:00.000Z'
});

// Channel
`session:${sessionId}:city:${cityId}` → `city:updated`
```

---

### 2.8 메시지 이벤트

#### 개인 메시지
```typescript
// Trigger
await MessageService.sendMessage(from, to, content);

// Payload
GameEventEmitter.broadcastMessage(sessionId, {
  messageId: 12345,
  from: { generalId: 123, generalName: '관우' },
  to: { generalId: 124, generalName: '장비' },
  content: '형님, 형님!',
  timestamp: '2025-11-23T15:00:00.000Z'
});

// Channel
`session:${sessionId}:general:${toGeneralId}` → `message:received`
```

#### 국가 메시지
```typescript
// Trigger
await MessageService.sendNationalMessage(nationId, content);

// Payload
GameEventEmitter.broadcastGameEvent(sessionId, 'message:national', {
  nationId: 1,
  nationName: '촉',
  content: '출정 준비를 하라!',
  timestamp: '2025-11-23T15:00:00.000Z'
});

// Channel
`session:${sessionId}:nation:${nationId}` → `message:national`
```

---

### 2.9 턴 완료 이벤트

```typescript
// Trigger
await ExecuteEngine.processTurn(sessionId);

// Payload
GameEventEmitter.broadcastTurnComplete(sessionId, turnNumber, nextTurnAt);

// Channel
`session:${sessionId}` → `turn:complete`
```

---

### 2.10 로그 업데이트 이벤트

#### 장수 동향
```typescript
// Trigger
await ActionLogger.pushGeneralActionLog(log);

// Payload
GameEventEmitter.broadcastLogUpdate(sessionId, generalId, 'action', logId, logText);

// Channel
`session:${sessionId}:general:${generalId}` → `log:updated`
```

#### 중원 정세
```typescript
// Trigger
await ActionLogger.pushGlobalHistoryLog(log);

// Payload
GameEventEmitter.broadcastLogUpdate(sessionId, 0, 'history', logId, logText);

// Channel
`session:${sessionId}` → `log:updated`
```

---

## 3. 프론트엔드 리스너 예시

### 3.1 React Hook

```typescript
// hooks/useGameEvents.ts
import { useEffect } from 'react';
import { socket } from '@/lib/socket';

export function useGameEvents(sessionId: string) {
  useEffect(() => {
    if (!sessionId) return;

    // 세션 룸 참여
    socket.emit('join:session', sessionId);

    // 경매 이벤트
    socket.on('auction:updated', (data) => {
      console.log('[Socket] Auction updated:', data);
      // 경매 목록 새로고침 또는 실시간 업데이트
    });

    socket.on('auction:closed', (data) => {
      console.log('[Socket] Auction closed:', data);
      // 경매 종료 알림
    });

    // 토너먼트 이벤트
    socket.on('tournament:updated', (data) => {
      console.log('[Socket] Tournament updated:', data);
      // 토너먼트 현황 업데이트
    });

    // 베팅 이벤트
    socket.on('betting:updated', (data) => {
      console.log('[Socket] Betting updated:', data);
      // 베팅 현황 업데이트
    });

    // 재정 이벤트
    socket.on('finance:updated', (data) => {
      console.log('[Socket] Finance updated:', data);
      // 국가 재정 현황 업데이트
    });

    // 턴 완료
    socket.on('turn:complete', (data) => {
      console.log('[Socket] Turn complete:', data);
      // 전체 UI 새로고침
    });

    return () => {
      socket.emit('leave:session', sessionId);
      socket.off('auction:updated');
      socket.off('auction:closed');
      socket.off('tournament:updated');
      socket.off('betting:updated');
      socket.off('finance:updated');
      socket.off('turn:complete');
    };
  }, [sessionId]);
}
```

### 3.2 개별 컴포넌트

```typescript
// components/AuctionList.tsx
import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

export function AuctionList({ sessionId }: { sessionId: string }) {
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    // 초기 데이터 로드
    fetchAuctions();

    // 실시간 업데이트
    socket.on('auction:updated', (data) => {
      setAuctions(prev => 
        prev.map(a => a._id === data.auctionId ? { ...a, ...data } : a)
      );
    });

    socket.on('auction:closed', (data) => {
      setAuctions(prev => 
        prev.filter(a => a._id !== data.auctionId)
      );
      
      // 토스트 알림
      toast.info(`경매 종료: ${data.winner?.winnerName}님이 낙찰받았습니다.`);
    });

    return () => {
      socket.off('auction:updated');
      socket.off('auction:closed');
    };
  }, [sessionId]);

  return (
    <div>
      {auctions.map(auction => (
        <AuctionCard key={auction._id} auction={auction} />
      ))}
    </div>
  );
}
```

---

## 4. Socket.IO Room 전략

### 4.1 Room 구조

```
session:{sessionId}
  └─> 모든 플레이어
      ├─ 경매 업데이트
      ├─ 토너먼트 업데이트
      ├─ 턴 완료
      └─ 중원 정세

session:{sessionId}:general:{generalId}
  └─> 특정 장수
      ├─ 개인 메시지
      ├─ 장수 정보 업데이트
      └─ 장수 동향

session:{sessionId}:nation:{nationId}
  └─> 특정 국가
      ├─ 국가 메시지
      ├─ 국가 정보 업데이트
      └─ 국가 재정

session:{sessionId}:city:{cityId}
  └─> 특정 도시
      └─ 도시 정보 업데이트

battle:{battleId}
  └─> 특정 전투
      └─ 전투 상태 업데이트
```

### 4.2 참여/나가기

```typescript
// 클라이언트
socket.emit('join:session', sessionId);
socket.emit('join:general', { sessionId, generalId });
socket.emit('join:nation', { sessionId, nationId });

socket.emit('leave:session', sessionId);
socket.emit('leave:general', { sessionId, generalId });
socket.emit('leave:nation', { sessionId, nationId });
```

---

## 5. 이벤트 우선순위

### 5.1 High Priority (즉시 전송)
- 턴 완료
- 전투 시작/종료
- 도시 점령
- 경매 종료

### 5.2 Medium Priority (1~2초 지연 허용)
- 경매 입찰
- 토너먼트 단계 변경
- 베팅 참여

### 5.3 Low Priority (5초 지연 허용)
- 재정 업데이트
- 로그 업데이트
- 일반 메시지

---

## 6. 에러 핸들링

### 6.1 Socket 연결 실패

```typescript
socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error);
  // 재연결 시도
  setTimeout(() => socket.connect(), 5000);
});
```

### 6.2 이벤트 수신 실패

```typescript
socket.on('error', (error) => {
  console.error('[Socket] Event error:', error);
  // 폴백: HTTP API로 데이터 재조회
  fetchLatestData();
});
```

---

## 7. 성능 최적화

### 7.1 이벤트 배칭

```typescript
// 여러 장수 업데이트를 한 번에 전송
const updates = [];
for (const general of generals) {
  updates.push({ generalId: general.no, gold: general.data.gold });
}

GameEventEmitter.broadcastGameEvent(sessionId, 'generals:batch_updated', {
  updates
});
```

### 7.2 Throttling

```typescript
// 1초에 최대 1번만 재정 업데이트 전송
const throttledFinanceUpdate = throttle((sessionId, nationId, data) => {
  GameEventEmitter.broadcastFinanceUpdate(sessionId, nationId, data);
}, 1000);
```

---

## 8. 보안

### 8.1 인증

```typescript
// Socket.IO 미들웨어
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  verifyToken(token)
    .then(user => {
      socket.data.user = user;
      next();
    })
    .catch(err => next(new Error('Invalid token')));
});
```

### 8.2 권한 확인

```typescript
socket.on('join:general', ({ sessionId, generalId }) => {
  const user = socket.data.user;
  
  // 해당 장수의 소유자인지 확인
  if (user.generalId !== generalId) {
    socket.emit('error', { message: 'Unauthorized' });
    return;
  }
  
  socket.join(`session:${sessionId}:general:${generalId}`);
});
```

---

## 9. 로깅 및 모니터링

### 9.1 이벤트 로그

```typescript
GameEventEmitter.broadcastAuctionUpdate = (sessionId, auctionId, updates) => {
  logger.info('[GameEventEmitter] Broadcasting auction update', {
    sessionId,
    auctionId,
    event: updates.event,
    timestamp: new Date().toISOString()
  });
  
  // 실제 브로드캐스트
  const socketManager = getSocketManager();
  socketManager.broadcastGameEvent(sessionId, 'auction:updated', {
    auctionId,
    ...updates
  });
};
```

### 9.2 메트릭

```typescript
// 프로메테우스 메트릭
socket_events_total{event="auction:updated",session="sangokushi_default"} 150
socket_events_total{event="tournament:updated",session="sangokushi_default"} 80
socket_connected_clients{session="sangokushi_default"} 45
```

---

## 10. 체크리스트

### 개발 시
- [ ] 이벤트 페이로드 타입 정의
- [ ] 프론트엔드 리스너 구현
- [ ] 에러 핸들링 추가
- [ ] 로깅 추가

### 배포 전
- [ ] Socket.IO 연결 테스트
- [ ] 이벤트 수신 테스트
- [ ] 대량 접속 부하 테스트
- [ ] 재연결 시나리오 테스트

### 운영 중
- [ ] 연결 수 모니터링
- [ ] 이벤트 전송량 모니터링
- [ ] 에러율 모니터링
- [ ] 지연 시간 모니터링
