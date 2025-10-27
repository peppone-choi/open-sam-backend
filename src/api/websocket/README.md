# WebSocket API

Entity 시스템 기반의 실시간 통신 API입니다.

## 아키텍처

```
Client <-> Socket.IO <-> Redis Pub/Sub <-> API Endpoints
```

- **Socket.IO**: 클라이언트와 실시간 양방향 통신
- **Redis Pub/Sub**: 서버 간 이벤트 브로드캐스트
- **EntityRepository**: 엔티티 저장소
- **RoleRepository**: Role 기반 엔티티 조회

## 주요 이벤트

### 1. game:state
전체 게임 상태 전송 (세션별)

```json
{
  "sessionId": "scenario-1",
  "data": {
    "entities": {...},
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

### 2. battle:event
전투 이벤트 전송 (전투별)

```json
{
  "battleId": "battle-123",
  "event": {
    "type": "damage",
    "target": "unit-1",
    "amount": 50
  }
}
```

### 3. entity:updated
엔티티 업데이트 전송 (Entity 시스템)

```json
{
  "scenario": "scenario-1",
  "role": "General",
  "id": "general-123",
  "patch": {
    "leadership": 85
  },
  "version": 5,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## API Endpoints

### GET /api/websocket/game-state/:scenario
시나리오의 전체 게임 상태 조회

**Response:**
```json
{
  "scenario": "scenario-1",
  "entities": {
    "General": [...],
    "City": [...],
    "Faction": [...]
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### GET /api/websocket/entities/:scenario/:role
특정 Role의 엔티티 목록 조회

**Response:**
```json
{
  "scenario": "scenario-1",
  "role": "General",
  "entities": [...],
  "count": 100
}
```

### GET /api/websocket/entity/:scenario/:role/:id
특정 엔티티 상세 조회

**Response:**
```json
{
  "id": "general-123",
  "name": "조조",
  "leadership": 85,
  ...
}
```

### POST /api/websocket/publish/game-state
게임 상태 변경 이벤트 발행

**Request:**
```json
{
  "sessionId": "scenario-1",
  "data": {...}
}
```

### POST /api/websocket/publish/battle-event
전투 이벤트 발행

**Request:**
```json
{
  "battleId": "battle-123",
  "event": {...}
}
```

### POST /api/websocket/publish/entity-update
엔티티 업데이트 이벤트 발행

**Request:**
```json
{
  "scenario": "scenario-1",
  "role": "General",
  "id": "general-123",
  "patch": {
    "leadership": 90
  }
}
```

## Socket.IO 클라이언트 사용법

### 연결
```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});
```

### 세션 참가
```typescript
socket.emit('join:session', 'scenario-1');
```

### 이벤트 수신
```typescript
// 게임 상태 업데이트
socket.on('game:state', (data) => {
  console.log('게임 상태 업데이트:', data);
});

// 전투 이벤트
socket.on('battle:event', (event) => {
  console.log('전투 이벤트:', event);
});

// 엔티티 업데이트
socket.on('entity:updated', (update) => {
  console.log('엔티티 업데이트:', update);
  // { scenario, role, id, patch, version, timestamp }
});
```

### 구독 관리
```typescript
// 장수 구독
socket.emit('subscribe:general', 'general-123');

// 도시 구독
socket.emit('subscribe:city', 'city-456');

// 구독 해제
socket.emit('unsubscribe:general', 'general-123');
```

## Redis Pub/Sub 채널

- `channel:game-state`: 게임 상태 변경
- `channel:battle`: 전투 이벤트
- `channel:general`: 장수 업데이트
- `channel:city`: 도시 업데이트
- `channel:entity`: 엔티티 업데이트 (Entity 시스템)

## 사용 예시

### 1. 엔티티 업데이트 후 실시간 동기화

```typescript
// API에서 엔티티 업데이트
const updated = await RoleRepository.update(
  { scenario: 'scenario-1', role: 'General', id: 'general-123' },
  { leadership: 90 }
);

// Redis Pub/Sub로 이벤트 발행
await redis.publish('channel:entity', {
  scenario: 'scenario-1',
  role: 'General',
  id: 'general-123',
  patch: { leadership: 90 },
  version: updated.version,
  timestamp: new Date().toISOString()
});

// WebSocket Server가 자동으로 클라이언트에게 전송
// -> socket.on('entity:updated', ...) 트리거
```

### 2. 전투 진행 중 실시간 이벤트

```typescript
// 전투 로직 실행
const damage = calculateDamage(attacker, defender);

// 전투 이벤트 발행
await redis.publish('channel:battle', {
  battleId: 'battle-123',
  event: {
    type: 'damage',
    attacker: 'unit-1',
    defender: 'unit-2',
    amount: damage
  }
});

// 클라이언트에서 자동 수신
// -> socket.on('battle:event', ...) 트리거
```

## 주의사항

1. **레거시 Service 사용 금지**: EntityRepository와 RoleRepository만 사용
2. **낙관적 잠금**: 버전 관리를 통한 동시성 제어
3. **타입 안전성**: Role은 `as any` 캐스팅으로 유연성 확보
4. **한글 주석**: 모든 주석은 한글로 작성
