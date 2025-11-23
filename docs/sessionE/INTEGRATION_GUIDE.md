# Session E 통합 가이드 (Integration Guide)

## 빠른 시작

Session E 기능을 기존 서버에 통합하는 단계별 가이드입니다.

---

## 1. 서버 시작 시 데몬 활성화

### server.ts 수정

```typescript
// server.ts
import { AuctionExpirationDaemon } from './daemons/AuctionExpirationDaemon';

// ... 기존 코드 ...

// Socket.IO 초기화 후
const httpServer = createServer(app);
const socketManager = initializeSocketIO(httpServer);

// 데몬 시작
AuctionExpirationDaemon.start(60000); // 1분마다 실행

logger.info('✅ AuctionExpirationDaemon started');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // 데몬 중지
  AuctionExpirationDaemon.stop();
  
  // 서버 종료
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
```

---

## 2. 턴 엔진에 재정 적용 추가

### ExecuteEngine.service.ts 수정

```typescript
// src/services/global/ExecuteEngine.service.ts
import { NationalFinanceService } from '../economy/NationalFinance.service';

// processTurn 함수 내부
async function processTurn(sessionId: string) {
  // ... 기존 턴 처리 로직 ...
  
  // 국가별 재정 처리
  const nations = await Nation.find({ session_id: sessionId });
  
  for (const nation of nations) {
    const nationId = nation.data?.nation;
    if (!nationId) continue;
    
    try {
      const finance = await NationalFinanceService.applyNationalFinance(
        sessionId,
        nationId
      );
      
      logger.info('[ExecuteEngine] National finance applied', {
        sessionId,
        nationId,
        netIncome: finance.netIncome
      });
    } catch (error: any) {
      logger.error('[ExecuteEngine] Failed to apply national finance', {
        sessionId,
        nationId,
        error: error.message
      });
    }
  }
  
  // ... 기존 턴 처리 로직 계속 ...
}
```

---

## 3. 토너먼트 데몬 통합

### TournamentDaemon.ts 생성 (새 파일)

```typescript
// src/daemons/TournamentDaemon.ts
import { processTournament } from '../services/tournament/TournamentEngine.service';
import { Session } from '../models/session.model';
import { logger } from '../common/logger';

export class TournamentDaemon {
  private static intervalHandle: NodeJS.Timeout | null = null;

  static start(intervalMs: number = 10000): void {
    if (this.intervalHandle) {
      logger.warn('[TournamentDaemon] Already running');
      return;
    }

    logger.info('[TournamentDaemon] Starting daemon', { intervalMs });
    
    this.processAllSessions();

    this.intervalHandle = setInterval(() => {
      this.processAllSessions();
    }, intervalMs);
  }

  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[TournamentDaemon] Daemon stopped');
    }
  }

  private static async processAllSessions(): Promise<void> {
    try {
      const sessions = await Session.find({ active: true });

      for (const session of sessions) {
        try {
          await processTournament(session.session_id);
        } catch (error: any) {
          logger.error('[TournamentDaemon] Error processing session', {
            sessionId: session.session_id,
            error: error.message
          });
        }
      }
    } catch (error: any) {
      logger.error('[TournamentDaemon] Error in processAllSessions', {
        error: error.message
      });
    }
  }
}
```

### server.ts에 추가

```typescript
import { TournamentDaemon } from './daemons/TournamentDaemon';

// 데몬 시작
AuctionExpirationDaemon.start(60000);
TournamentDaemon.start(10000); // 10초마다

logger.info('✅ Daemons started');

// Graceful shutdown
process.on('SIGTERM', () => {
  AuctionExpirationDaemon.stop();
  TournamentDaemon.stop();
  // ...
});
```

---

## 4. API 라우트 추가

### routes/nation.routes.ts 수정

```typescript
// src/routes/nation.routes.ts
import { NationalFinanceService } from '../services/economy/NationalFinance.service';

router.get('/finance/:nationId', async (req, res) => {
  try {
    const sessionId = req.query.session_id as string || 'sangokushi_default';
    const nationId = parseInt(req.params.nationId);

    const finance = await NationalFinanceService.getNationalFinance(
      sessionId,
      nationId
    );

    res.json({
      success: true,
      data: finance
    });
  } catch (error: any) {
    logger.error('[Nation API] Failed to get finance', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

---

## 5. 프론트엔드 Socket.IO 연결

### lib/socket.ts 생성 (프론트엔드)

```typescript
// open-sam-front/src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

export const socket: Socket = io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  auth: {
    token: typeof window !== 'undefined' ? localStorage.getItem('token') : null
  }
});

socket.on('connect', () => {
  console.log('[Socket] Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket] Disconnected');
});

socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error);
});
```

### hooks/useGameEvents.ts 생성 (프론트엔드)

```typescript
// open-sam-front/src/hooks/useGameEvents.ts
import { useEffect } from 'react';
import { socket } from '@/lib/socket';

export function useGameEvents(sessionId: string) {
  useEffect(() => {
    if (!sessionId) return;

    // 세션 룸 참여
    socket.emit('join:session', sessionId);

    // 경매 이벤트
    const handleAuctionUpdate = (data: any) => {
      console.log('[Socket] Auction updated:', data);
      // 경매 목록 새로고침 또는 실시간 업데이트
    };

    const handleAuctionClosed = (data: any) => {
      console.log('[Socket] Auction closed:', data);
      // 알림 표시
    };

    // 토너먼트 이벤트
    const handleTournamentUpdate = (data: any) => {
      console.log('[Socket] Tournament updated:', data);
      // 토너먼트 현황 업데이트
    };

    // 베팅 이벤트
    const handleBettingUpdate = (data: any) => {
      console.log('[Socket] Betting updated:', data);
      // 베팅 현황 업데이트
    };

    // 재정 이벤트
    const handleFinanceUpdate = (data: any) => {
      console.log('[Socket] Finance updated:', data);
      // 재정 현황 업데이트
    };

    // 턴 완료
    const handleTurnComplete = (data: any) => {
      console.log('[Socket] Turn complete:', data);
      // 전체 UI 새로고침
    };

    // 리스너 등록
    socket.on('auction:updated', handleAuctionUpdate);
    socket.on('auction:closed', handleAuctionClosed);
    socket.on('tournament:updated', handleTournamentUpdate);
    socket.on('betting:updated', handleBettingUpdate);
    socket.on('finance:updated', handleFinanceUpdate);
    socket.on('turn:complete', handleTurnComplete);

    return () => {
      socket.emit('leave:session', sessionId);
      socket.off('auction:updated', handleAuctionUpdate);
      socket.off('auction:closed', handleAuctionClosed);
      socket.off('tournament:updated', handleTournamentUpdate);
      socket.off('betting:updated', handleBettingUpdate);
      socket.off('finance:updated', handleFinanceUpdate);
      socket.off('turn:complete', handleTurnComplete);
    };
  }, [sessionId]);
}
```

---

## 6. 환경 변수 설정

### .env (백엔드)

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Daemons
AUCTION_CHECK_INTERVAL=60000      # 1분
AUCTION_LOCK_TTL=30               # 30초
TOURNAMENT_CHECK_INTERVAL=10000   # 10초
TOURNAMENT_LOCK_TTL=60            # 60초

# Socket.IO
SOCKET_IO_PATH=/socket.io
SOCKET_IO_CORS_ORIGIN=http://localhost:3000
```

### .env.local (프론트엔드)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```

---

## 7. 데이터베이스 인덱스 생성

### MongoDB Shell

```javascript
// auctions 컬렉션
db.auctions.createIndex({ session_id: 1, finished: 1, closeDate: 1 });
db.auctions.createIndex({ session_id: 1, type: 1, finished: 1 });
db.auctions.createIndex({ session_id: 1, target: 1, finished: 1 });

// tournament 컬렉션
db.tournaments.createIndex({ session_id: 1, grp: 1, grp_no: 1 });
db.tournaments.createIndex({ session_id: 1, prmt: 1 });
db.tournaments.createIndex({ session_id: 1, no: 1 });

// betting 컬렉션
db.bettings.createIndex({ session_id: 1, finished: 1 });
db.bettings.createIndex({ session_id: 1, id: 1 });

// cities 컬렉션
db.cities.createIndex({ session_id: 1, 'data.nation': 1 });

// generals 컬렉션
db.generals.createIndex({ session_id: 1, 'data.nation': 1, 'data.npc': 1 });

// nations 컬렉션
db.nations.createIndex({ session_id: 1, 'data.nation': 1 });
```

---

## 8. 테스트 방법

### 경매 데몬 테스트

```typescript
// test-auction-daemon.ts
import { AuctionExpirationDaemon } from './src/daemons/AuctionExpirationDaemon';
import { Auction } from './src/models/auction.model';

async function test() {
  // 만료된 경매 생성
  const auction = await Auction.create({
    session_id: 'test',
    type: 'UniqueItem',
    target: 'weapon_QingLongYanYueDao',
    hostGeneralId: 0,
    hostName: '(상인)',
    reqResource: 'inheritancePoint',
    openDate: new Date(Date.now() - 3600000),
    closeDate: new Date(Date.now() - 60000), // 1분 전
    amount: 1,
    startBidAmount: 100,
    finished: false,
    title: '청룡언월도 경매',
    bids: []
  });

  console.log('Created expired auction:', auction._id);

  // 데몬 실행
  await AuctionExpirationDaemon.processSession('test');

  // 경매 종료 확인
  const updated = await Auction.findById(auction._id);
  console.log('Auction finished:', updated.finished);
}

test();
```

### 재정 계산 테스트

```bash
curl -X GET "http://localhost:8080/api/nation/finance/1?session_id=sangokushi_default"
```

### Socket.IO 테스트

```typescript
// test-socket.ts (프론트엔드)
import { socket } from '@/lib/socket';

socket.emit('join:session', 'sangokushi_default');

socket.on('auction:updated', (data) => {
  console.log('Auction updated:', data);
});

socket.on('turn:complete', (data) => {
  console.log('Turn complete:', data);
});
```

---

## 9. 배포 순서

### 1단계: 백엔드 배포
```bash
cd open-sam-backend
npm install
npm run build
pm2 restart api
```

### 2단계: 데몬 활성화 확인
```bash
pm2 logs api | grep "Daemon started"
```

### 3단계: 프론트엔드 배포
```bash
cd open-sam-front
npm install
npm run build
pm2 restart frontend
```

### 4단계: 기능 검증
- [ ] 경매 만료 처리 확인
- [ ] 토너먼트 진행 확인
- [ ] 재정 계산 확인
- [ ] Socket.IO 연결 확인

---

## 10. 트러블슈팅

### Redis 연결 실패
```bash
# Redis 상태 확인
redis-cli ping

# Redis 로그 확인
tail -f /var/log/redis/redis-server.log
```

### 데몬 실행 안됨
```bash
# PM2 로그 확인
pm2 logs api --lines 100

# 수동 실행 테스트
node dist/test-auction-daemon.js
```

### Socket.IO 연결 실패
```bash
# 백엔드 로그 확인
pm2 logs api | grep "Socket"

# 프론트엔드 브라우저 콘솔 확인
# F12 → Console → "Socket" 필터
```

---

## 11. 롤백 계획

### 데몬 비활성화
```typescript
// server.ts에서 주석 처리
// AuctionExpirationDaemon.start(60000);
// TournamentDaemon.start(10000);
```

### 재정 적용 비활성화
```typescript
// ExecuteEngine.service.ts에서 주석 처리
// await NationalFinanceService.applyNationalFinance(sessionId, nationId);
```

### 이전 버전으로 복구
```bash
pm2 stop api
git checkout <previous-commit>
npm install
npm run build
pm2 start api
```

---

## 12. 성능 최적화 팁

### Redis 연결 풀 설정
```typescript
// src/config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  connectionName: 'opensam-api'
});
```

### 데이터베이스 쿼리 최적화
```typescript
// 한 번에 여러 국가 조회
const finances = await Promise.all(
  nationIds.map(id => 
    NationalFinanceService.getNationalFinance(sessionId, id)
  )
);
```

### Socket.IO 배치 전송
```typescript
// 여러 장수 업데이트를 한 번에 전송
const updates = generals.map(g => ({
  generalId: g.no,
  gold: g.data.gold
}));

GameEventEmitter.broadcastGameEvent(sessionId, 'generals:batch_updated', {
  updates
});
```

---

## 체크리스트

### 개발 완료
- [x] 경매 데몬 구현
- [x] 토너먼트 엔진 포팅
- [x] 국가 재정 구현
- [x] 이벤트 브로드캐스트 연결
- [x] 문서화

### 통합 완료
- [ ] server.ts 수정
- [ ] ExecuteEngine 수정
- [ ] API 라우트 추가
- [ ] 프론트엔드 Socket.IO 연결
- [ ] 환경 변수 설정
- [ ] DB 인덱스 생성

### 테스트 완료
- [ ] 경매 데몬 테스트
- [ ] 토너먼트 테스트
- [ ] 재정 계산 테스트
- [ ] Socket.IO 테스트
- [ ] 부하 테스트

### 배포 완료
- [ ] 백엔드 배포
- [ ] 프론트엔드 배포
- [ ] 기능 검증
- [ ] 모니터링 설정
