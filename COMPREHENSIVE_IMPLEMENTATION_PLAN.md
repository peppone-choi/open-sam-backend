# 종합 구현 계획서

Oracle 분석 + 레거시 PHP + 현재 구현 상태 종합

## 📋 Executive Summary

**목표**: 레거시 PHP 삼국지 게임을 TypeScript + Express + MongoDB + CQRS로 마이그레이션하고, 40x40 실시간 전투 시스템 구현

**현재 상태**:
- ✅ 30개 도메인 스켈레톤 생성 완료
- ✅ CQRS + Single Writer 아키텍처 설계 완료
- ✅ Mongoose 스키마 기본 구조 완료
- ⚠️ Redis Streams 미구현
- ⚠️ 실시간 전투 시스템 미구현
- ⚠️ Game Daemon 로직 미구현

---

## 🎯 Phase 1: 핵심 인프라 (1-2일)

### 1.1 Redis Streams Consumer Group 구현 ✅

**파일**: `src/infrastructure/cache/redis.service.ts`

```typescript
// TODO: 추가 메서드
async xgroupCreate(stream: string, group: string, id: string = '0'): Promise<void>
async xreadgroup(
  group: string, 
  consumer: string, 
  streams: string[], 
  count?: number
): Promise<any>
async xack(stream: string, group: string, id: string): Promise<void>
```

**구현 포인트**:
- Consumer Group 생성 (XGROUP CREATE)
- XREADGROUP으로 메시지 읽기
- XACK로 처리 완료 표시
- 재시도 로직 (Pending 메시지 처리)

### 1.2 CommandProcessor 실제 구현 ✅

**파일**: `src/api/daemon/command-processor.ts`

```typescript
class CommandProcessor {
  async start() {
    // 1. Consumer Group 생성
    await this.redisService.xgroupCreate('cmd:game', 'game-daemon', '0');
    
    // 2. 무한 루프로 메시지 소비
    while (true) {
      const messages = await this.redisService.xreadgroup(
        'game-daemon',
        'worker-1',
        ['cmd:game'],
        10
      );
      
      for (const msg of messages) {
        await this.processCommand(msg);
        await this.redisService.xack('cmd:game', 'game-daemon', msg.id);
      }
    }
  }
  
  async processCommand(msg: any) {
    switch (msg.type) {
      case 'START_BATTLE':
        await this.battleHandler.handleStartBattle(msg);
        break;
      case 'BATTLE_ACTION':
        await this.battleHandler.handleBattleAction(msg);
        break;
      // TODO: 다른 명령 타입들
    }
  }
}
```

### 1.3 GameLoop 타이머 구현 ✅

**파일**: `src/api/daemon/game-loop.ts`

```typescript
class GameLoop {
  start() {
    // 1초마다 틱
    setInterval(() => this.onSecond(), 1000);
  }
  
  async onSecond() {
    const now = Date.now();
    
    // TODO: 전투 처리
    await this.battleHandler.processActiveBattles(now);
    
    // TODO: 완료된 명령 확인
    await this.checkCompletedCommands(now);
    
    // TODO: 월말 이벤트
    if (this.isMonthEnd()) {
      await this.processMonthlyEvents();
    }
  }
}
```

---

## 🎮 Phase 2: 실시간 전투 시스템 (2-3일)

### 2.1 Battle 스키마 확장 ✅

**파일**: `src/api/battle/battle.schema.ts`

```typescript
const BattleSchema = new Schema({
  sessionId: String,
  cityId: String,
  
  // 전투 타입
  battleType: { type: String, enum: ['field', 'siege'] },
  
  // 진영
  attackerNationId: String,
  defenderNationId: String,
  attackDirection: { type: String, enum: ['north', 'south', 'east', 'west'] },
  
  // 성 정보 (공성전)
  castleX: Number,
  castleY: Number,
  castleSize: Number,
  
  // 페이즈
  status: { type: String, enum: ['pending', 'in_progress', 'completed'] },
  currentPhase: { type: Number, default: 0 },
  maxPhases: { type: Number, default: 100 },
  phaseIntervalMs: { type: Number, default: 5000 }, // 5초
  
  // 유닛 (임베디드)
  units: [{
    generalId: String,
    side: String, // 'attacker' | 'defender'
    position: { x: Number, y: Number },
    crew: Number,
    crewMax: Number,
    crewType: Number,
    morale: Number,
    alive: Boolean,
  }],
  
  // 전투 로그 (델타만 저장)
  battleLog: [Schema.Types.Mixed],
  
  // 승리 조건
  winnerId: String,
  
  startTime: Date,
  endTime: Date,
});
```

### 2.2 BattleFieldTile 스키마 생성 ✅

**파일**: `src/api/battlefield-tile/battlefield-tile.schema.ts` (생성 완료!)

**중요**: 도시당 1600개 타일을 DB에 미리 생성하여 저장

```typescript
const BattleFieldTileSchema = new Schema({
  cityId: { type: String, required: true },
  
  // 40x40 그리드를 평탄화해서 저장
  tiles: [{
    x: Number,
    y: Number,
    terrainType: String, // 'plain', 'forest', 'hill', 'water', 'castle'
    movable: Boolean,
    moveCost: Number,
    defenseBonus: Number,
    height: Number,
  }],
});

// 인덱스
BattleFieldTileSchema.index({ cityId: 1 }, { unique: true });
```

**생성 로직**:
```typescript
// 도시당 최초 1회 생성
async generateTilesForCity(cityId: string) {
  const tiles = [];
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      tiles.push({
        x, y,
        terrainType: this.randomTerrain(),
        movable: true,
        moveCost: 1,
        defenseBonus: 0,
        height: 0,
      });
    }
  }
  
  // 중앙에 성 배치
  const castleX = 20, castleY = 20, castleSize = 3;
  for (let dy = 0; dy < castleSize; dy++) {
    for (let dx = 0; dx < castleSize; dx++) {
      const idx = (castleY + dy) * 40 + (castleX + dx);
      tiles[idx].terrainType = 'castle';
      tiles[idx].defenseBonus = 10;
    }
  }
  
  await BattleFieldTileModel.create({ cityId, tiles });
}
```

### 2.3 StateManager 확장 ✅

**파일**: `src/api/daemon/state-manager.ts`

```typescript
interface BattleState {
  battleId: string;
  tiles: Array<{x: number, y: number, terrainType: string}>;
  units: Map<string, BattleUnit>;
  currentPhase: number;
  nextPhaseAt: number;
}

interface BattleUnit {
  generalId: string;
  side: 'attacker' | 'defender';
  position: {x: number, y: number};
  crew: number;
  crewType: number;
  morale: number;
  alive: boolean;
}

class StateManager {
  private activeBattles: Map<string, BattleState> = new Map();
  
  loadBattle(battleId: string, data: any) {
    this.activeBattles.set(battleId, data);
  }
  
  getBattle(battleId: string): BattleState | undefined {
    return this.activeBattles.get(battleId);
  }
  
  removeBattle(battleId: string) {
    this.activeBattles.delete(battleId);
  }
  
  getAllActiveBattles(): BattleState[] {
    return Array.from(this.activeBattles.values());
  }
}
```

### 2.4 BattleHandler 구현 ✅

**파일**: `src/api/daemon/handlers/battle.handler.ts`

```typescript
class BattleHandler {
  async handleStartBattle(command: any) {
    const { cityId, attackDirection, attackerGenerals, defenderGenerals } = command.payload;
    
    // 1. 타일 로드 (없으면 생성)
    let tiles = await this.battleFieldTileRepository.findByCityId(cityId);
    if (!tiles) {
      tiles = await this.generateTilesForCity(cityId);
    }
    
    // 2. 유닛 배치
    const units = this.placeUnits(attackDirection, attackerGenerals, defenderGenerals);
    
    // 3. Battle 문서 생성
    const battle = await this.battleRepository.create({
      sessionId: command.sessionId,
      cityId,
      attackDirection,
      status: 'in_progress',
      currentPhase: 0,
      units,
    });
    
    // 4. 인메모리 상태 로드
    this.stateManager.loadBattle(battle.id, {
      battleId: battle.id,
      tiles: tiles.tiles,
      units: new Map(units.map(u => [u.generalId, u])),
      currentPhase: 0,
      nextPhaseAt: Date.now() + 5000,
    });
    
    // 5. WebSocket 브로드캐스트
    this.wsService.broadcast(`battle:${battle.id}`, {
      type: 'battle:started',
      battleId: battle.id,
      units,
    });
    
    return battle;
  }
  
  async processActiveBattles(now: number) {
    const battles = this.stateManager.getAllActiveBattles();
    
    for (const battle of battles) {
      if (now >= battle.nextPhaseAt) {
        await this.processPhase(battle);
        battle.nextPhaseAt = now + 5000;
      }
    }
  }
  
  async processPhase(battleState: BattleState) {
    const { battleId, units, currentPhase } = battleState;
    
    // 1. 행동 순서 결정 (속도 순)
    const sortedUnits = Array.from(units.values())
      .filter(u => u.alive)
      .sort((a, b) => this.getSpeed(b) - this.getSpeed(a));
    
    const results = [];
    
    // 2. 각 유닛 행동
    for (const unit of sortedUnits) {
      const action = this.decideAction(unit, battleState); // AI
      const result = await this.executeAction(unit, action, battleState);
      results.push(result);
    }
    
    // 3. 승리 조건 확인
    const winner = this.checkVictory(battleState);
    if (winner) {
      await this.endBattle(battleId, winner);
      return;
    }
    
    // 4. 상태 업데이트
    battleState.currentPhase++;
    
    // 5. 5페이즈마다 영속화
    if (currentPhase % 5 === 0) {
      await this.battleRepository.updatePhase(battleId, {
        currentPhase,
        units: Array.from(units.values()),
      });
    }
    
    // 6. WebSocket 브로드캐스트 (델타만)
    this.wsService.broadcast(`battle:${battleId}`, {
      type: 'battle:phase',
      phase: currentPhase,
      results,
    });
  }
  
  decideAction(unit: BattleUnit, state: BattleState): Action {
    // TODO: 간단한 AI
    // - 공격자: 성으로 이동 또는 가장 가까운 적 공격
    // - 방어자: 현재 위치 유지 또는 가장 가까운 적 공격
    
    const enemies = Array.from(state.units.values())
      .filter(u => u.side !== unit.side && u.alive);
    
    if (enemies.length === 0) return { type: 'WAIT' };
    
    const nearest = this.findNearest(unit.position, enemies);
    const distance = this.manhattanDistance(unit.position, nearest.position);
    
    if (distance === 1) {
      return { type: 'ATTACK', target: nearest.generalId };
    } else {
      return { type: 'MOVE', to: this.moveToward(unit.position, nearest.position, state.tiles) };
    }
  }
  
  async executeAction(unit: BattleUnit, action: Action, state: BattleState): Promise<ActionResult> {
    switch (action.type) {
      case 'MOVE':
        unit.position = action.to;
        return { type: 'moved', generalId: unit.generalId, to: action.to };
        
      case 'ATTACK':
        const target = state.units.get(action.target);
        if (!target) return { type: 'failed' };
        
        const damage = this.calculateDamage(unit, target, state);
        target.crew -= damage;
        
        if (target.crew <= 0) {
          target.alive = false;
          return { type: 'killed', attacker: unit.generalId, target: target.generalId };
        }
        
        // 반격
        const counterDamage = this.calculateDamage(target, unit, state) * 0.5;
        unit.crew -= counterDamage;
        
        return { 
          type: 'attacked', 
          attacker: unit.generalId, 
          target: target.generalId,
          damage,
          counterDamage,
        };
        
      case 'WAIT':
        return { type: 'waited', generalId: unit.generalId };
    }
  }
  
  calculateDamage(attacker: BattleUnit, defender: BattleUnit, state: BattleState): number {
    // BATTLE_SYSTEM.md 기반 공식
    const attackPower = attacker.crew * (attacker.morale / 100) * this.getCrewTypeBonus(attacker.crewType, defender.crewType);
    
    const defenderTile = state.tiles.find(t => t.x === defender.position.x && t.y === defender.position.y);
    const defenseBonus = defenderTile?.defenseBonus || 0;
    const defensePower = defender.crew * 0.5 + defenseBonus;
    
    const damage = Math.max(attackPower - defensePower, 0);
    return Math.floor(damage);
  }
  
  checkVictory(state: BattleState): 'attacker' | 'defender' | null {
    const attackers = Array.from(state.units.values()).filter(u => u.side === 'attacker' && u.alive);
    const defenders = Array.from(state.units.values()).filter(u => u.side === 'defender' && u.alive);
    
    if (attackers.length === 0) return 'defender';
    if (defenders.length === 0) return 'attacker';
    
    // TODO: 성 점령 조건
    
    return null;
  }
  
  async endBattle(battleId: string, winner: string) {
    const battle = await this.battleRepository.findById(battleId);
    
    // 1. 상태 업데이트
    await this.battleRepository.update(battleId, {
      status: 'completed',
      winnerId: winner,
      endTime: new Date(),
    });
    
    // 2. 도시 소유권 변경 (공성전 승리 시)
    if (battle.battleType === 'siege' && winner === 'attacker') {
      await this.cityRepository.update(battle.cityId, {
        nation: battle.attackerNationId,
      });
    }
    
    // 3. 캐시 무효화
    await this.cacheManager.invalidate(`city:${battle.cityId}`);
    
    // 4. 인메모리 상태 제거
    this.stateManager.removeBattle(battleId);
    
    // 5. WebSocket 브로드캐스트
    this.wsService.broadcast(`battle:${battleId}`, {
      type: 'battle:ended',
      winner,
    });
  }
}
```

---

## 🌐 Phase 3: WebSocket 서버 (반나절)

### 3.1 WebSocket 서버 추가 ✅

**파일**: `src/infrastructure/websocket/ws.service.ts` (신규)

```typescript
import { Server } from 'socket.io';
import http from 'http';

class WebSocketService {
  private io: Server;
  
  initialize(server: http.Server) {
    this.io = new Server(server, {
      cors: { origin: '*' }
    });
    
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // 전투 구독
      socket.on('subscribe:battle', (battleId: string) => {
        socket.join(`battle:${battleId}`);
      });
      
      socket.on('unsubscribe:battle', (battleId: string) => {
        socket.leave(`battle:${battleId}`);
      });
    });
  }
  
  broadcast(channel: string, data: any) {
    this.io.to(channel).emit('message', data);
  }
}

export const wsService = new WebSocketService();
```

**통합**: `src/server.ts`

```typescript
const server = http.createServer(app);

// WebSocket 초기화
wsService.initialize(server);

server.listen(PORT, () => {
  console.log(`✅ API Server + WS running on port ${PORT}`);
});
```

---

## 📊 Phase 4: API 엔드포인트 (반나절)

### 4.1 Command API 활성화

**파일**: `src/api/command/controller/command.controller.ts`

```typescript
// POST /api/commands
async submit(req: Request, res: Response) {
  const { sessionId, type, payload } = req.body;
  
  // Redis Streams에 발행
  const messageId = await this.commandQueue.publish({
    sessionId,
    generalId: payload.generalId,
    type,
    payload,
  });
  
  res.status(202).json({
    message: 'Command submitted',
    messageId,
  });
}
```

### 4.2 Battle API 조회

**파일**: `src/api/battle/controller/battle.controller.ts`

```typescript
// GET /api/battles/:id
async getById(req: Request, res: Response) {
  const battle = await this.battleService.getById(req.params.id);
  res.json({ data: battle });
}

// GET /api/battles/active
async getActive(req: Request, res: Response) {
  const { sessionId } = req.query;
  const battles = await this.battleService.getActive(sessionId);
  res.json({ data: battles });
}
```

---

## 🧪 Phase 5: 테스트 및 디버깅 (1일)

### 5.1 테스트 시나리오

1. **명령 발행 테스트**
   ```bash
   curl -X POST http://localhost:3000/api/commands \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test-session",
       "type": "START_BATTLE",
       "payload": {
         "cityId": "city-1",
         "attackDirection": "north",
         "attackerGenerals": ["gen-1", "gen-2"],
         "defenderGenerals": ["gen-3", "gen-4"]
       }
     }'
   ```

2. **WebSocket 구독 테스트**
   ```javascript
   const socket = io('http://localhost:3000');
   socket.emit('subscribe:battle', 'battle-123');
   socket.on('message', (data) => console.log(data));
   ```

3. **전투 진행 확인**
   - Daemon 로그 확인
   - MongoDB에 페이즈 업데이트 확인
   - WebSocket 메시지 수신 확인

---

## 📈 우선순위 요약

### 🔴 HIGH (1-2일 내)
1. ✅ Redis Streams 구현
2. ✅ CommandProcessor 실제 로직
3. ✅ Battle 스키마 확장
4. ✅ BattleHandler 기본 구현

### 🟡 MEDIUM (3-5일 내)
5. ✅ 40x40 타일 생성/저장
6. ✅ 간단한 AI (이동/공격)
7. ✅ WebSocket 서버
8. ✅ 승리 조건 처리

### 🟢 LOW (1-2주 내)
9. ⚠️ 복잡한 스킬 시스템
10. ⚠️ Phaser.js 시각화
11. ⚠️ 리플레이 시스템
12. ⚠️ 이벤트 소싱

---

## 📚 레거시 PHP 핵심 로직 매핑

### 레거시 → 신규 매핑

| 레거시 PHP | 신규 TypeScript |
|---|---|
| `WarUnit` | `BattleUnit` (StateManager) |
| `WarUnitTrigger` | 향후 `TriggerSystem` |
| `generalBattleDetail` | `Battle.battleLog` |
| `general_turn` | `GeneralTurn` 모델 |
| `plock` | `Plock` 모델 (동시성 제어) |
| `monthly events` | `GameLoop.processMonthlyEvents()` |

### 주요 차이점

1. **동시성**
   - 레거시: MySQL 트랜잭션 + plock 테이블
   - 신규: Single Writer Daemon + Redis Streams

2. **전투**
   - 레거시: 추상화된 전투 (40x40 없음)
   - 신규: 실제 40x40 그리드 + 실시간 페이즈

3. **캐시**
   - 레거시: 없음 (매번 DB 조회)
   - 신규: 2-Tier (node-cache + Redis)

---

## ✅ 다음 단계

1. **Redis Streams 구현** → `infrastructure/cache/redis.service.ts`
2. **CommandProcessor 완성** → `daemon/command-processor.ts`
3. **BattleHandler 작성** → `daemon/handlers/battle.handler.ts`
4. **WebSocket 서버 추가** → `infrastructure/websocket/ws.service.ts`
5. **테스트 클라이언트 작성** → 간단한 HTML 페이지

**예상 소요 시간**: 2-3일 (집중 작업 기준)

**완료 후 결과물**:
- ✅ 실시간 40x40 전투 시스템
- ✅ CQRS + Single Writer 완전 동작
- ✅ WebSocket으로 전투 실시간 스트리밍
- ✅ 간단한 AI (이동/공격)
