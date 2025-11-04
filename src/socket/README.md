# Socket.IO 실시간 통신 시스템

게임의 실시간 업데이트를 위한 Socket.IO 구현입니다.

## 구조

### 핸들러
- `socketManager.ts` - Socket.IO 서버 관리 및 초기화
- `game.socket.ts` - 게임 이벤트 (턴, 세션 상태)
- `general.socket.ts` - 장수 이벤트 (정보 업데이트, 명령 실행)
- `nation.socket.ts` - 국가 이벤트 (정보 업데이트, 외교)
- `battle.socket.ts` - 전투 이벤트 (전투 진행, 액션)

### 이벤트 타입

#### 게임 이벤트
- `game:subscribe` - 세션 구독
- `game:unsubscribe` - 세션 구독 해제
- `game:status` - 게임 상태 조회
- `game:month:changed` - 월 변경 알림
- `game:turn:complete` - 턴 완료 알림

#### 장수 이벤트
- `general:subscribe` - 장수 구독
- `general:unsubscribe` - 장수 구독 해제
- `general:updated` - 장수 정보 업데이트

#### 국가 이벤트
- `nation:subscribe` - 국가 구독
- `nation:unsubscribe` - 국가 구독 해제
- `nation:updated` - 국가 정보 업데이트
- `diplomacy:subscribe` - 외교 이벤트 구독
- `diplomacy:unsubscribe` - 외교 이벤트 구독 해제

#### 전투 이벤트
- `battle:join` - 전투 참가
- `battle:leave` - 전투 떠남
- `battle:action` - 전투 액션 제출
- `battle:ready` - 준비 완료
- `battle:started` - 전투 시작
- `battle:ended` - 전투 종료
- `battle:turn_resolved` - 턴 해결

## 사용 방법

### 백엔드에서 이벤트 전송

```typescript
import { GameEventEmitter } from '../services/gameEventEmitter';

// 턴 완료 브로드캐스트
GameEventEmitter.broadcastTurnComplete(sessionId, turnNumber, nextTurnAt);

// 장수 정보 업데이트
GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, updates);

// 국가 정보 업데이트
GameEventEmitter.broadcastNationUpdate(sessionId, nationId, updates);
```

### 프론트엔드에서 이벤트 수신

```typescript
import { useSocket } from '@/hooks/useSocket';

function GameComponent() {
  const { socket, isConnected, onTurnComplete, onGeneralEvent } = useSocket({
    token: authToken,
    sessionId: 'sangokushi_default'
  });

  // 턴 완료 이벤트
  useEffect(() => {
    const cleanup = onTurnComplete((data) => {
      console.log('턴 완료:', data);
      // 게임 상태 새로고침
    });
    return cleanup;
  }, [onTurnComplete]);

  // 장수 업데이트 이벤트
  useEffect(() => {
    const cleanup = onGeneralEvent('updated', (data) => {
      console.log('장수 업데이트:', data);
      // 장수 정보 업데이트
    });
    return cleanup;
  }, [onGeneralEvent]);

  return <div>...</div>;
}
```

## 인증

Socket.IO 연결 시 JWT 토큰을 `auth.token`으로 전달해야 합니다:

```typescript
const socket = io('http://localhost:8080', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## 룸 구조

- `session:{sessionId}` - 세션별 브로드캐스트
- `user:{userId}` - 사용자별 메시지
- `general:{generalId}` - 장수별 업데이트
- `nation:{nationId}` - 국가별 업데이트
- `battle:{battleId}` - 전투별 이벤트
- `turn:{sessionId}` - 턴 완료 알림

