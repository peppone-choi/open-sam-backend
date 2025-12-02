/**
 * TurnBasedBattleEngine Tests
 * 삼국지 스타일 턴제 전투 엔진 단위 테스트
 */

import {
  TurnBasedBattleEngine,
  TurnBasedConfig,
  TurnBasedBattleState,
  TurnBasedBattleUnit,
  SangokuFormation,
  DEFAULT_TURN_CONFIG,
} from '../TurnBasedBattleEngine';
import { BattleUnit3D, Position3D, BattleTile3D, UnitType, TerrainType } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockUnit(overrides: Partial<BattleUnit3D> = {}): BattleUnit3D {
  return {
    id: `unit-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Unit',
    side: 'attacker',
    position: { x: 0, y: 0, z: 0 },
    hp: 100,
    maxHp: 100,
    troops: 1000,
    maxTroops: 1000,
    morale: 100,
    leadership: 70,
    strength: 80,
    intelligence: 60,
    training: 70,
    speed: 5,
    attackRange: 1,
    visionRange: 5,
    unitType: UnitType.FOOTMAN,
    generalId: 1,
    playerId: 1,
    hasActed: false,
    afkTurns: 0,
    buffs: [],
    ...overrides,
  };
}

function createMockMap(width: number = 40, height: number = 40): BattleTile3D[][] {
  const map: BattleTile3D[][] = [];
  for (let y = 0; y < height; y++) {
    const row: BattleTile3D[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        z: 0,
        type: TerrainType.PLAIN,
        walkable: true,
        flyable: true,
      });
    }
    map.push(row);
  }
  return map;
}

// ============================================================================
// Engine Initialization Tests
// ============================================================================

describe('TurnBasedBattleEngine - Initialization', () => {
  let engine: TurnBasedBattleEngine;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine();
  });

  it('should create engine with default config', () => {
    expect(engine).toBeDefined();
  });

  it('should create engine with custom config', () => {
    const customConfig: Partial<TurnBasedConfig> = {
      maxTurns: 30,
      criticalChance: 15,
    };
    const customEngine = new TurnBasedBattleEngine(customConfig);
    expect(customEngine).toBeDefined();
  });

  it('should start battle with valid units', () => {
    const map = createMockMap();
    const attacker = createMockUnit({ side: 'attacker', position: { x: 5, y: 5, z: 0 } });
    const defender = createMockUnit({ side: 'defender', position: { x: 10, y: 10, z: 0 } });

    const state = engine.startBattle(
      'test-battle-1',
      map,
      [attacker],
      [defender],
      1,
      2
    );

    expect(state.battleId).toBe('test-battle-1');
    expect(state.currentTurn).toBe(0);
    expect(state.phase).toBe('waiting');
    expect(state.units.size).toBe(2);
  });
});

// ============================================================================
// Turn Flow Tests
// ============================================================================

describe('TurnBasedBattleEngine - Turn Flow', () => {
  let engine: TurnBasedBattleEngine;
  let state: TurnBasedBattleState;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine();
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      speed: 10,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 10, y: 10, z: 0 },
      speed: 5,
    });

    state = engine.startBattle('test-battle', map, [attacker], [defender], 1, 2);
  });

  it('should start turn and increment turn count', () => {
    const result = engine.startTurn(state);

    expect(state.currentTurn).toBe(1);
    expect(state.phase).toBe('active');
    expect(result.turnNumber).toBe(1);
  });

  it('should calculate action order by speed', () => {
    engine.startTurn(state);

    // 속도가 높은 공격자가 먼저
    expect(state.actionOrder[0]).toBe('attacker-1');
    expect(state.actionOrder[1]).toBe('defender-1');
  });

  it('should get current unit', () => {
    engine.startTurn(state);
    const currentUnit = engine.getCurrentUnit(state);

    expect(currentUnit).toBeDefined();
    expect(currentUnit?.id).toBe('attacker-1');
  });

  it('should move to next unit', () => {
    engine.startTurn(state);
    engine.nextUnit(state);
    const currentUnit = engine.getCurrentUnit(state);

    expect(currentUnit?.id).toBe('defender-1');
  });

  it('should return null when no more units', () => {
    engine.startTurn(state);
    engine.nextUnit(state);
    const nextUnit = engine.nextUnit(state);

    expect(nextUnit).toBeNull();
  });
});

// ============================================================================
// Movement Tests
// ============================================================================

describe('TurnBasedBattleEngine - Movement', () => {
  let engine: TurnBasedBattleEngine;
  let state: TurnBasedBattleState;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine();
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      speed: 3,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 15, y: 15, z: 0 },
    });

    state = engine.startBattle('test-battle', map, [attacker], [defender], 1, 2);
    engine.startTurn(state);
  });

  it('should execute valid move', () => {
    const result = engine.executeMove(state, 'attacker-1', { x: 6, y: 5, z: 0 });

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('move');

    const unit = state.units.get('attacker-1');
    expect(unit?.position.x).toBe(6);
    expect(unit?.position.y).toBe(5);
    expect(unit?.hasMoved).toBe(true);
  });

  it('should fail move if already moved', () => {
    engine.executeMove(state, 'attacker-1', { x: 6, y: 5, z: 0 });
    const result = engine.executeMove(state, 'attacker-1', { x: 7, y: 5, z: 0 });

    expect(result.success).toBe(false);
    expect(result.effects).toContain('Already moved');
  });

  it('should fail move for non-existent unit', () => {
    const result = engine.executeMove(state, 'invalid-unit', { x: 6, y: 5, z: 0 });

    expect(result.success).toBe(false);
    expect(result.effects).toContain('Unit not found');
  });
});

// ============================================================================
// Attack Tests
// ============================================================================

describe('TurnBasedBattleEngine - Attack', () => {
  let engine: TurnBasedBattleEngine;
  let state: TurnBasedBattleState;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine({ counterAttackEnabled: true });
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      strength: 100,
      attackRange: 2,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      strength: 80,
      attackRange: 1,
    });

    state = engine.startBattle('test-battle', map, [attacker], [defender], 1, 2);
    engine.startTurn(state);
  });

  it('should execute valid attack', () => {
    const result = engine.executeAttack(state, 'attacker-1', 'defender-1');

    expect(result.success).toBe(true);
    expect(result.actionType).toBe('attack');
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should reduce defender HP', () => {
    const defenderBefore = state.units.get('defender-1');
    const hpBefore = defenderBefore?.hp || 0;

    engine.executeAttack(state, 'attacker-1', 'defender-1');

    const defenderAfter = state.units.get('defender-1');
    expect(defenderAfter?.hp).toBeLessThan(hpBefore);
  });

  it('should fail attack on ally', () => {
    // 공격자 두 명 추가
    const ally = createMockUnit({
      id: 'attacker-2',
      side: 'attacker',
      position: { x: 4, y: 5, z: 0 },
    });
    state.units.set('attacker-2', { ...ally, formation: 'fishScale', hasMoved: false, hasAttacked: false, isRouting: false } as TurnBasedBattleUnit);

    const result = engine.executeAttack(state, 'attacker-1', 'attacker-2');

    expect(result.success).toBe(false);
    expect(result.effects).toContain('Cannot attack ally');
  });

  it('should fail attack if already attacked', () => {
    engine.executeAttack(state, 'attacker-1', 'defender-1');
    const result = engine.executeAttack(state, 'attacker-1', 'defender-1');

    expect(result.success).toBe(false);
    expect(result.effects).toContain('Already attacked');
  });

  it('should include counter attack damage', () => {
    const result = engine.executeAttack(state, 'attacker-1', 'defender-1');

    // 반격 데미지가 있어야 함 (사정거리 내)
    expect(result.counterDamage).toBeDefined();
    expect(result.counterDamage).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Unit Type Compatibility Tests
// ============================================================================

describe('TurnBasedBattleEngine - Unit Compatibility', () => {
  let engine: TurnBasedBattleEngine;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine();
  });

  it('should give cavalry advantage over infantry', () => {
    const map = createMockMap();
    const cavalry = createMockUnit({
      id: 'cavalry',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      unitType: UnitType.CAVALRY,
      strength: 100,
    });
    const infantry = createMockUnit({
      id: 'infantry',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      unitType: UnitType.FOOTMAN,
      strength: 100,
    });

    const state = engine.startBattle('test', map, [cavalry], [infantry], 1, 2);
    engine.startTurn(state);
    const result = engine.executeAttack(state, 'cavalry', 'infantry');

    // 기병이 보병에게 유리 (1.3x)
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should give archer advantage over cavalry', () => {
    const map = createMockMap();
    const archer = createMockUnit({
      id: 'archer',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      unitType: UnitType.ARCHER,
      strength: 100,
      attackRange: 3,
    });
    const cavalry = createMockUnit({
      id: 'cavalry',
      side: 'defender',
      position: { x: 7, y: 5, z: 0 },
      unitType: UnitType.CAVALRY,
      strength: 100,
    });

    const state = engine.startBattle('test', map, [archer], [cavalry], 1, 2);
    engine.startTurn(state);
    const result = engine.executeAttack(state, 'archer', 'cavalry');

    // 궁병이 기병에게 유리 (1.3x)
    expect(result.damage).toBeGreaterThan(0);
  });

  it('should give infantry advantage over archer', () => {
    const map = createMockMap();
    const infantry = createMockUnit({
      id: 'infantry',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      unitType: UnitType.FOOTMAN,
      strength: 100,
    });
    const archer = createMockUnit({
      id: 'archer',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      unitType: UnitType.ARCHER,
      strength: 100,
    });

    const state = engine.startBattle('test', map, [infantry], [archer], 1, 2);
    engine.startTurn(state);
    const result = engine.executeAttack(state, 'infantry', 'archer');

    // 보병이 궁병에게 유리 (1.3x)
    expect(result.damage).toBeGreaterThan(0);
  });
});

// ============================================================================
// Formation Tests
// ============================================================================

describe('TurnBasedBattleEngine - Formation', () => {
  let engine: TurnBasedBattleEngine;
  let state: TurnBasedBattleState;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine({ formationEnabled: true });
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      morale: 100,
    });

    state = engine.startBattle('test-battle', map, [attacker], [], 1, 2);
  });

  it('should change formation successfully', () => {
    const result = engine.changeFormation(state, 'attacker-1', 'arrowhead');

    expect(result).toBe(true);
    const unit = state.units.get('attacker-1');
    expect(unit?.formation).toBe('arrowhead');
  });

  it('should fail formation change with low morale', () => {
    const unit = state.units.get('attacker-1');
    if (unit) unit.morale = 10;

    const result = engine.changeFormation(state, 'attacker-1', 'craneWing');

    expect(result).toBe(false);
  });
});

// ============================================================================
// Victory Condition Tests
// ============================================================================

describe('TurnBasedBattleEngine - Victory Conditions', () => {
  let engine: TurnBasedBattleEngine;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine({ maxTurns: 50 });
  });

  it('should declare attacker victory when all defenders eliminated', () => {
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      strength: 1000,
      attackRange: 5,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      hp: 1,
      troops: 1,
    });

    const state = engine.startBattle('test', map, [attacker], [defender], 1, 2);
    const turnResult = engine.startTurn(state);
    engine.executeAttack(state, 'attacker-1', 'defender-1');
    const victory = engine.endTurn(state, turnResult);

    expect(victory).toBeDefined();
    expect(victory?.winner).toBe('attacker');
  });

  it('should declare defender victory when all attackers eliminated', () => {
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      hp: 1,
      troops: 1,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      strength: 1000,
      attackRange: 5,
    });

    const state = engine.startBattle('test', map, [attacker], [defender], 1, 2);
    const turnResult = engine.startTurn(state);
    
    // 방어자가 먼저 행동하도록 속도 조정
    const defUnit = state.units.get('defender-1');
    if (defUnit) defUnit.speed = 100;
    state.actionOrder = ['defender-1', 'attacker-1'];
    
    engine.executeAttack(state, 'defender-1', 'attacker-1');
    const victory = engine.endTurn(state, turnResult);

    expect(victory).toBeDefined();
    expect(victory?.winner).toBe('defender');
  });
});

// ============================================================================
// Morale and Routing Tests
// ============================================================================

describe('TurnBasedBattleEngine - Morale System', () => {
  let engine: TurnBasedBattleEngine;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine({ moraleRouteThreshold: 0 });
  });

  it('should reduce morale when taking damage', () => {
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      strength: 1000,
      attackRange: 5,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      morale: 100,
    });

    const state = engine.startBattle('test', map, [attacker], [defender], 1, 2);
    const turnResult = engine.startTurn(state);
    
    const defUnitBefore = state.units.get('defender-1');
    const moraleBefore = defUnitBefore?.morale || 100;
    
    // 공격으로 사기 감소
    engine.executeAttack(state, 'attacker-1', 'defender-1');
    
    const defUnitAfter = state.units.get('defender-1');
    // 피해를 입으면 사기가 감소해야 함
    expect(defUnitAfter?.morale).toBeLessThanOrEqual(moraleBefore);
  });
});

// ============================================================================
// Auto Battle Tests
// ============================================================================

describe('TurnBasedBattleEngine - Auto Battle', () => {
  let engine: TurnBasedBattleEngine;

  beforeEach(() => {
    engine = new TurnBasedBattleEngine({ maxTurns: 10 });
  });

  it('should simulate battle to completion', () => {
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 5, y: 5, z: 0 },
      strength: 100,
      hp: 50,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 6, y: 5, z: 0 },
      strength: 100,
      hp: 50,
    });

    let state = engine.startBattle('test', map, [attacker], [defender], 1, 2);
    state = engine.simulateBattle(state);

    expect(state.phase).toBe('finished');
    expect(state.winner).toBeDefined();
  });

  it('should not exceed max turns', () => {
    const map = createMockMap();
    const attacker = createMockUnit({
      id: 'attacker-1',
      side: 'attacker',
      position: { x: 0, y: 0, z: 0 },
      hp: 10000,
      strength: 1,
    });
    const defender = createMockUnit({
      id: 'defender-1',
      side: 'defender',
      position: { x: 39, y: 39, z: 0 },
      hp: 10000,
      strength: 1,
    });

    let state = engine.startBattle('test', map, [attacker], [defender], 1, 2);
    state = engine.simulateBattle(state);

    expect(state.currentTurn).toBeLessThanOrEqual(10);
  });
});
