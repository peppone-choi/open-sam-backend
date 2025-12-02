# 에이전트 6: 테스트 및 QA

## 프롬프트

```
당신은 게임 QA 엔지니어입니다.

## 프로젝트 컨텍스트
- 오픈 삼국: 삼국지 웹 전략 게임 + 은하영웅전설 모드
- 두 가지 전투 시스템 테스트 필요
  - 삼국지: 그리드 기반 턴제 전투
  - 은하영웅전설: 연속좌표 기반 실시간 전투

## 작업 내용
1. 단위 테스트 작성
   - BattleEngine 테스트
   - 데미지 계산 테스트
   - 병종 상성 테스트
   - 위치 시스템 테스트

2. 통합 테스트 작성
   - 전투 흐름 테스트
   - WebSocket 통신 테스트
   - DB 저장/조회 테스트

3. E2E 테스트 작성 (Playwright)
   - 전투 UI 테스트
   - 유닛 이동/공격 테스트
   - 전투 결과 표시 테스트

4. 성능 테스트
   - 동시 전투 처리 테스트
   - 메모리 사용량 모니터링
   - 렌더링 성능 테스트 (60fps)

## 기술 스택
- Jest (단위/통합 테스트)
- Playwright (E2E 테스트)
- Socket.io-mock (WebSocket 테스트)

## 주요 요구사항
- 커버리지 80% 이상
- CI/CD 파이프라인 연동 가능
- 테스트 결과 리포트 생성

## 출력물
- __tests__/ 디렉토리에 테스트 파일
- 테스트 설정 파일 업데이트
- 테스트 문서
```

---

## 필수 참고 파일

### 1. 기존 테스트 파일
```
open-sam-backend/src/services/logh/__tests__/
├── GalaxyAuthorityCard.service.test.ts
├── Gin7CommandExecution.service.test.ts
├── Gin7Frontend.service.test.ts
└── Gin7StrategicLoop.service.test.ts

open-sam-front/src/components/logh/__tests__/
└── SteeringPanel.test.tsx
```

### 2. 테스트 설정
```
open-sam-backend/
├── jest.config.js           # Jest 설정
├── package.json             # test 스크립트
└── tsconfig.json            # TypeScript 설정

open-sam-front/
├── jest.config.js           # (있다면)
└── playwright.config.ts     # (있다면)
```

### 3. 테스트 대상 파일
```
# 백엔드 - 전투 엔진
open-sam-backend/src/core/battle/
├── BattleEngine.ts
├── BattleResolver.ts
├── BattleValidator.ts
├── BattleAI.ts
└── types.ts

# 백엔드 - 서비스
open-sam-backend/src/services/battle/
├── BattleEngine.service.ts
├── BattleResult.service.ts
└── AutoBattle.service.ts

open-sam-backend/src/services/logh/
├── RealtimeCombat.service.ts
├── FleetCombat.service.ts
└── FleetMovement.service.ts

# 프론트엔드 - 컴포넌트
open-sam-front/src/components/battle/
├── BattleMap.tsx
├── UnitSprite.tsx
├── BattleResultLog.tsx
└── HPBar.tsx
```

### 4. 체크리스트 문서
```
open-sam-backend/docs/AUTO_BATTLE_CHECKLIST.md
open-sam-backend/scripts/check-battle-readiness.ts
```

---

## 테스트 계획

### 1. 단위 테스트 (Unit Tests)

#### 1.1 Position 시스템
```typescript
// __tests__/core/battle/Position.test.ts
describe('Position System', () => {
  describe('PositionConverter', () => {
    test('gridToContinuous: 그리드 좌표를 연속 좌표로 변환', () => {
      const grid = { type: 'grid', x: 20, y: 20 };
      const continuous = PositionConverter.gridToContinuous(grid);
      
      expect(continuous.x).toBeCloseTo(5125, 0);  // (20 * 250) + 125
      expect(continuous.y).toBeCloseTo(5125, 0);
    });
    
    test('continuousToGrid: 연속 좌표를 그리드 좌표로 변환', () => {
      const continuous = { type: 'continuous', x: 5000, y: 5000 };
      const grid = PositionConverter.continuousToGrid(continuous);
      
      expect(grid.x).toBe(20);
      expect(grid.y).toBe(20);
    });
    
    test('distance: 두 점 사이 거리 계산', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 3, y: 4 };
      
      expect(PositionConverter.distance(a, b)).toBe(5);
    });
    
    test('gridDistance: 맨해튼 거리 계산', () => {
      const a = { type: 'grid', x: 0, y: 0 };
      const b = { type: 'grid', x: 3, y: 4 };
      
      expect(PositionConverter.gridDistance(a, b)).toBe(7);
    });
  });
});
```

#### 1.2 데미지 계산
```typescript
// __tests__/core/battle/DamageCalculator.test.ts
describe('DamageCalculator', () => {
  test('기본 데미지 계산', () => {
    const attacker = createMockUnit({ attack: 100, crew: 1000 });
    const defender = createMockUnit({ defense: 50 });
    
    const damage = DamageCalculator.calculate(attacker, defender);
    
    expect(damage).toBeGreaterThan(0);
  });
  
  test('병종 상성 보정: 기병 > 보병', () => {
    const cavalry = createMockUnit({ crewType: 1300, attack: 100 });
    const infantry = createMockUnit({ crewType: 1100, defense: 50 });
    
    const damage = DamageCalculator.calculate(cavalry, infantry);
    const baseDamage = DamageCalculator.calculate(cavalry, cavalry);
    
    expect(damage).toBeGreaterThan(baseDamage);  // 상성 보너스
  });
  
  test('병종 상성 보정: 궁병 > 기병', () => {
    const archer = createMockUnit({ crewType: 1200, attack: 100 });
    const cavalry = createMockUnit({ crewType: 1300, defense: 50 });
    
    const damage = DamageCalculator.calculate(archer, cavalry);
    const baseDamage = DamageCalculator.calculate(archer, archer);
    
    expect(damage).toBeGreaterThan(baseDamage);
  });
  
  test('진형 보정: 어린 진형 공격력 증가', () => {
    const attacker = createMockUnit({ formation: 'fishScale', attack: 100 });
    const defender = createMockUnit({ defense: 50 });
    
    const damage = DamageCalculator.calculate(attacker, defender);
    const baseDamage = DamageCalculator.calculate(
      { ...attacker, formation: 'circular' },
      defender
    );
    
    expect(damage).toBeGreaterThan(baseDamage);
  });
  
  test('크리티컬 히트', () => {
    // 시드 고정으로 크리티컬 발생 보장
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
    
    const attacker = createMockUnit({ attack: 100 });
    const defender = createMockUnit({ defense: 50 });
    
    const result = DamageCalculator.calculateWithCritical(attacker, defender);
    
    expect(result.isCritical).toBe(true);
    expect(result.damage).toBeGreaterThan(
      DamageCalculator.calculate(attacker, defender)
    );
    
    jest.restoreAllMocks();
  });
});
```

#### 1.3 이동 시스템
```typescript
// __tests__/core/battle/Movement.test.ts
describe('Movement System', () => {
  describe('Grid Movement (Samgukji)', () => {
    test('이동 가능 범위 계산', () => {
      const unit = createMockUnit({ position: { x: 5, y: 5 }, speed: 3 });
      const map = createMockMap(40, 40);
      
      const movable = MovementCalculator.getMovablePositions(unit, map);
      
      // 속도 3 = 최대 3칸 이동 가능
      expect(movable.length).toBeGreaterThan(0);
      expect(movable.every(pos => 
        PositionConverter.gridDistance(unit.position, pos) <= 3
      )).toBe(true);
    });
    
    test('장애물 회피', () => {
      const unit = createMockUnit({ position: { x: 5, y: 5 }, speed: 3 });
      const map = createMockMap(40, 40, [{ x: 6, y: 5, type: 'obstacle' }]);
      
      const movable = MovementCalculator.getMovablePositions(unit, map);
      
      expect(movable.find(pos => pos.x === 6 && pos.y === 5)).toBeUndefined();
    });
  });
  
  describe('Continuous Movement (LOGH)', () => {
    test('속도 기반 이동', () => {
      const fleet = createMockFleet({
        position: { x: 1000, y: 1000 },
        velocity: { x: 100, y: 0 },
      });
      
      const deltaTime = 1; // 1초
      const newPosition = MovementCalculator.updatePosition(fleet, deltaTime);
      
      expect(newPosition.x).toBe(1100);
      expect(newPosition.y).toBe(1000);
    });
    
    test('목적지 설정', () => {
      const fleet = createMockFleet({
        position: { x: 1000, y: 1000 },
        speed: 100,
      });
      const destination = { x: 2000, y: 1000 };
      
      const velocity = MovementCalculator.setDestination(fleet, destination);
      
      expect(velocity.x).toBe(100);  // 정규화된 방향 × 속도
      expect(velocity.y).toBe(0);
    });
    
    test('facing 계산', () => {
      const fleet = createMockFleet({ position: { x: 0, y: 0 } });
      const destination = { x: 100, y: 100 };
      
      const facing = MovementCalculator.calculateFacing(
        fleet.position, 
        destination
      );
      
      expect(facing).toBeCloseTo(45, 0);  // 45도
    });
  });
});
```

#### 1.4 전투 엔진
```typescript
// __tests__/core/battle/BattleEngine.test.ts
describe('BattleEngine', () => {
  describe('Turn-based Battle (Samgukji)', () => {
    let engine: TurnBasedBattleEngine;
    
    beforeEach(() => {
      engine = new TurnBasedBattleEngine();
    });
    
    test('전투 초기화', () => {
      const battle = engine.createBattle({
        attackerUnits: [createMockUnit()],
        defenderUnits: [createMockUnit()],
      });
      
      expect(battle.status).toBe('preparing');
      expect(battle.turn).toBe(0);
    });
    
    test('전투 시작', () => {
      const battle = engine.createBattle({
        attackerUnits: [createMockUnit()],
        defenderUnits: [createMockUnit()],
      });
      
      engine.startBattle(battle);
      
      expect(battle.status).toBe('ongoing');
      expect(battle.turn).toBe(1);
    });
    
    test('유닛 이동', () => {
      const unit = createMockUnit({ position: { x: 5, y: 5 } });
      const battle = engine.createBattle({
        attackerUnits: [unit],
        defenderUnits: [createMockUnit()],
      });
      
      engine.startBattle(battle);
      const success = engine.moveUnit(battle, unit.id, { x: 6, y: 5 });
      
      expect(success).toBe(true);
      expect(unit.position).toEqual({ x: 6, y: 5 });
    });
    
    test('유닛 공격', () => {
      const attacker = createMockUnit({ position: { x: 5, y: 5 }, attack: 100 });
      const defender = createMockUnit({ position: { x: 6, y: 5 }, hp: 100 });
      
      const battle = engine.createBattle({
        attackerUnits: [attacker],
        defenderUnits: [defender],
      });
      
      engine.startBattle(battle);
      const result = engine.attackUnit(battle, attacker.id, defender.id);
      
      expect(result.damage).toBeGreaterThan(0);
      expect(defender.hp).toBeLessThan(100);
    });
    
    test('전투 종료 조건: 모든 적 처치', () => {
      const attacker = createMockUnit({ attack: 1000 });
      const defender = createMockUnit({ hp: 1 });
      
      const battle = engine.createBattle({
        attackerUnits: [attacker],
        defenderUnits: [defender],
      });
      
      engine.startBattle(battle);
      engine.attackUnit(battle, attacker.id, defender.id);
      
      expect(battle.status).toBe('finished');
      expect(battle.result).toBe('attacker_win');
    });
  });
  
  describe('Realtime Battle (LOGH)', () => {
    let engine: RealtimeBattleEngine;
    
    beforeEach(() => {
      engine = new RealtimeBattleEngine({ tickRate: 50 });
    });
    
    test('tick 처리', () => {
      const fleet = createMockFleet({
        position: { x: 1000, y: 1000 },
        velocity: { x: 100, y: 0 },
      });
      
      const battle = engine.createBattle({
        attackerUnits: [fleet],
        defenderUnits: [createMockFleet()],
      });
      
      engine.startBattle(battle);
      engine.tick(battle, 0.05);  // 50ms
      
      expect(fleet.position.x).toBeCloseTo(1005, 0);  // 100 * 0.05
    });
    
    test('사정거리 내 자동 공격', () => {
      const attacker = createMockFleet({
        position: { x: 1000, y: 1000 },
        attackRange: 500,
      });
      const defender = createMockFleet({
        position: { x: 1400, y: 1000 },
        hp: 100,
      });
      
      const battle = engine.createBattle({
        attackerUnits: [attacker],
        defenderUnits: [defender],
      });
      
      engine.startBattle(battle);
      engine.setTarget(battle, attacker.id, defender.id);
      engine.tick(battle, 1);  // 1초
      
      expect(defender.hp).toBeLessThan(100);
    });
  });
});
```

### 2. 통합 테스트 (Integration Tests)

#### 2.1 전투 서비스
```typescript
// __tests__/services/battle/BattleEngine.service.test.ts
describe('BattleEngine.service', () => {
  let service: BattleEngineService;
  let mockDb: MockDatabase;
  
  beforeEach(async () => {
    mockDb = new MockDatabase();
    service = new BattleEngineService(mockDb);
  });
  
  test('전투 생성 및 저장', async () => {
    const battleId = await service.createBattle({
      attackerGenerals: [1],
      defenderGenerals: [2],
      location: '낙양',
    });
    
    expect(battleId).toBeDefined();
    
    const battle = await service.getBattle(battleId);
    expect(battle).toBeDefined();
    expect(battle.status).toBe('preparing');
  });
  
  test('전투 실행 및 결과 저장', async () => {
    const battleId = await service.createBattle({
      attackerGenerals: [1],
      defenderGenerals: [2],
      location: '낙양',
    });
    
    await service.executeBattle(battleId);
    
    const battle = await service.getBattle(battleId);
    expect(battle.status).toBe('finished');
    expect(battle.result).toBeDefined();
    expect(battle.logs.length).toBeGreaterThan(0);
  });
});
```

#### 2.2 WebSocket 테스트
```typescript
// __tests__/services/logh/WebSocket.test.ts
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

describe('WebSocket Battle', () => {
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: any;
  
  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });
  
  afterAll(() => {
    ioServer.close();
    clientSocket.close();
  });
  
  test('전투 상태 브로드캐스트', (done) => {
    clientSocket.on('battle:state', (data: any) => {
      expect(data.fleets).toBeDefined();
      expect(data.timestamp).toBeDefined();
      done();
    });
    
    ioServer.emit('battle:state', {
      fleets: [{ id: '1', position: { x: 0, y: 0 } }],
      timestamp: Date.now(),
    });
  });
  
  test('이동 명령 수신', (done) => {
    ioServer.on('connection', (socket) => {
      socket.on('command:move', (data) => {
        expect(data.fleetId).toBe('1');
        expect(data.destination).toEqual({ x: 100, y: 100 });
        done();
      });
    });
    
    clientSocket.emit('command:move', {
      fleetId: '1',
      destination: { x: 100, y: 100 },
    });
  });
});
```

### 3. E2E 테스트 (Playwright)

```typescript
// e2e/battle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Battle UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // 로그인
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
  });
  
  test('전투 맵 렌더링', async ({ page }) => {
    await page.goto('http://localhost:3000/battle/test-battle-id');
    
    // 전투 맵 존재 확인
    await expect(page.locator('.battle-map')).toBeVisible();
    
    // 유닛 표시 확인
    await expect(page.locator('.unit-sprite')).toHaveCount({ min: 2 });
  });
  
  test('유닛 선택', async ({ page }) => {
    await page.goto('http://localhost:3000/battle/test-battle-id');
    
    // 유닛 클릭
    await page.click('.unit-sprite:first-child');
    
    // 선택 하이라이트 확인
    await expect(page.locator('.unit-sprite.selected')).toBeVisible();
    
    // 이동 가능 범위 표시 확인
    await expect(page.locator('.cell.movable')).toHaveCount({ min: 1 });
  });
  
  test('유닛 이동', async ({ page }) => {
    await page.goto('http://localhost:3000/battle/test-battle-id');
    
    // 유닛 선택
    await page.click('.unit-sprite:first-child');
    
    // 이동 가능 셀 클릭
    await page.click('.cell.movable:first-child');
    
    // 이동 확인 (위치 변경)
    // ... 애니메이션 완료 대기
    await page.waitForTimeout(500);
  });
  
  test('전투 로그 표시', async ({ page }) => {
    await page.goto('http://localhost:3000/battle/test-battle-id');
    
    // 전투 진행
    await page.click('.unit-sprite:first-child');
    await page.click('.cell.attackable:first-child');
    
    // 로그 패널 확인
    await expect(page.locator('.battle-log')).toBeVisible();
    await expect(page.locator('.battle-log .log-entry')).toHaveCount({ min: 1 });
  });
});

test.describe('LOGH Tactical Map', () => {
  test('실시간 함대 이동', async ({ page }) => {
    await page.goto('http://localhost:3000/logh/battle/test-battle-id');
    
    // Canvas 존재 확인
    await expect(page.locator('canvas.tactical-map')).toBeVisible();
    
    // 함대 선택 (Canvas 클릭)
    await page.click('canvas.tactical-map', { position: { x: 400, y: 300 } });
    
    // HUD 표시 확인
    await expect(page.locator('.fleet-hud')).toBeVisible();
  });
});
```

### 4. 성능 테스트

```typescript
// __tests__/performance/battle.perf.test.ts
describe('Performance Tests', () => {
  test('대규모 전투 처리 시간', () => {
    const engine = new TurnBasedBattleEngine();
    const battle = engine.createBattle({
      attackerUnits: Array.from({ length: 10 }, () => createMockUnit()),
      defenderUnits: Array.from({ length: 10 }, () => createMockUnit()),
    });
    
    const startTime = performance.now();
    
    engine.startBattle(battle);
    while (battle.status !== 'finished') {
      engine.autoPlayTurn(battle);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`전투 처리 시간: ${duration}ms`);
    expect(duration).toBeLessThan(1000);  // 1초 이내
  });
  
  test('실시간 전투 tick 성능', () => {
    const engine = new RealtimeBattleEngine({ tickRate: 50 });
    const battle = engine.createBattle({
      attackerUnits: Array.from({ length: 5 }, () => createMockFleet()),
      defenderUnits: Array.from({ length: 5 }, () => createMockFleet()),
    });
    
    engine.startBattle(battle);
    
    const tickTimes: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();
      engine.tick(battle, 0.05);
      const endTime = performance.now();
      tickTimes.push(endTime - startTime);
    }
    
    const avgTickTime = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
    
    console.log(`평균 tick 처리 시간: ${avgTickTime.toFixed(2)}ms`);
    expect(avgTickTime).toBeLessThan(10);  // 10ms 이내 (50ms tick에 여유)
  });
});
```

---

## 테스트 실행 명령어

```bash
# 단위 테스트
cd open-sam-backend && npm test

# 특정 파일 테스트
cd open-sam-backend && npm test -- --testPathPattern="BattleEngine"

# 커버리지 리포트
cd open-sam-backend && npm test -- --coverage

# E2E 테스트 (Playwright)
cd open-sam-front && npx playwright test

# E2E 테스트 (UI 모드)
cd open-sam-front && npx playwright test --ui
```

---

## 체크리스트

### 단위 테스트
- [ ] Position 시스템 테스트
- [ ] 데미지 계산 테스트
- [ ] 병종 상성 테스트
- [ ] 이동 시스템 테스트
- [ ] 턴제 전투 엔진 테스트
- [ ] 실시간 전투 엔진 테스트

### 통합 테스트
- [ ] 전투 서비스 테스트
- [ ] DB 저장/조회 테스트
- [ ] WebSocket 통신 테스트

### E2E 테스트
- [ ] 전투 맵 렌더링 테스트
- [ ] 유닛 선택/이동 테스트
- [ ] 전투 로그 테스트
- [ ] LOGH 전술 맵 테스트

### 성능 테스트
- [ ] 대규모 전투 처리 시간
- [ ] tick 성능 (< 10ms)
- [ ] 메모리 사용량

### 문서
- [ ] 테스트 실행 가이드
- [ ] 커버리지 리포트




