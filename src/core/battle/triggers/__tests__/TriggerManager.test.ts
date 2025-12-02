/**
 * TriggerManager 유닛 테스트
 */

import {
  TriggerManager,
  TriggerContext,
  createBattleEnvironment,
  DefaultRandomGenerator,
  SeededRandomGenerator,
  BaseTrigger,
  TriggerResult,
  TriggerTiming,
  TriggerPriority,
} from '../TriggerManager';
import { initializeAllTriggers, getAllTriggers, getTriggerStats } from '../index';
import { BattleUnit3D, BattleState, UnitType, TerrainType } from '../../types';

// 테스트용 모의 유닛 생성
function createMockUnit(overrides: Partial<BattleUnit3D> = {}): BattleUnit3D {
  return {
    id: 'unit-1',
    name: '테스트 장수',
    generalId: 1,
    playerId: 1,
    side: 'attacker',
    position: { x: 0, y: 0, z: 0 },
    troops: 1000,
    maxTroops: 1000,
    hp: 100,
    maxHp: 100,
    unitType: UnitType.FOOTMAN,
    leadership: 80,
    strength: 85,
    intelligence: 70,
    morale: 100,
    training: 100,
    speed: 10,
    attackRange: 1,
    visionRange: 5,
    hasActed: false,
    afkTurns: 0,
    skills: [],
    ...overrides,
  };
}

// 테스트용 모의 전투 상태 생성
function createMockBattleState(): BattleState {
  return {
    battleId: 'test-battle',
    currentTurn: 1,
    phase: 'resolution',
    map: [[{
      x: 0, y: 0, z: 0,
      type: TerrainType.PLAIN,
      walkable: true,
      flyable: true,
    }]],
    units: new Map(),
    buildings: [],
    attackerPlayerId: 1,
    defenderPlayerId: 2,
    turnSeconds: 30,
    resolutionSeconds: 5,
    actions: new Map(),
    readyPlayers: new Set(),
    aiControlled: new Set(),
    battleLog: [],
  };
}

describe('TriggerManager', () => {
  let manager: TriggerManager;

  beforeEach(() => {
    manager = new TriggerManager();
  });

  describe('트리거 등록', () => {
    it('트리거를 등록할 수 있다', () => {
      const trigger = new TestTrigger();
      manager.register(trigger);
      
      expect(manager.getTrigger('test_trigger')).toBe(trigger);
    });

    it('동일 ID 트리거는 덮어쓴다', () => {
      const trigger1 = new TestTrigger();
      const trigger2 = new TestTrigger();
      
      manager.register(trigger1);
      manager.register(trigger2);
      
      expect(manager.getTrigger('test_trigger')).toBe(trigger2);
    });

    it('트리거를 제거할 수 있다', () => {
      const trigger = new TestTrigger();
      manager.register(trigger);
      manager.unregister('test_trigger');
      
      expect(manager.getTrigger('test_trigger')).toBeUndefined();
    });
  });

  describe('트리거 실행', () => {
    it('등록된 트리거를 실행한다', () => {
      const trigger = new TestTrigger();
      manager.register(trigger);
      
      const ctx = createTestContext();
      const results = manager.executeTriggers('before_attack', ctx);
      
      expect(results.length).toBe(1);
      expect(results[0].triggered).toBe(true);
    });

    it('조건이 맞지 않으면 실행하지 않는다', () => {
      const trigger = new ConditionalTrigger(false);
      manager.register(trigger);
      
      const ctx = createTestContext();
      const results = manager.executeTriggers('before_attack', ctx);
      
      expect(results.length).toBe(0);
    });

    it('우선순위 순서대로 실행한다', () => {
      const trigger1 = new PriorityTrigger(200, 'second');
      const trigger2 = new PriorityTrigger(100, 'first');
      
      manager.register(trigger1);
      manager.register(trigger2);
      
      const ctx = createTestContext();
      const results = manager.executeTriggers('before_attack', ctx);
      
      expect(results[0].effects?.[0]).toBe('first');
      expect(results[1].effects?.[0]).toBe('second');
    });

    it('continueChain=false면 체인을 중단한다', () => {
      const trigger1 = new StopChainTrigger();
      const trigger2 = new TestTrigger();
      
      manager.register(trigger1);
      manager.register(trigger2);
      
      const ctx = createTestContext();
      const results = manager.executeTriggers('before_attack', ctx);
      
      expect(results.length).toBe(1);
    });
  });

  describe('스킬 관리', () => {
    it('스킬을 활성화할 수 있다', () => {
      const env = createBattleEnvironment();
      
      manager.activateSkill(env, '필살', '회피');
      
      expect(manager.hasActivatedSkill(env, '필살')).toBe(true);
      expect(manager.hasActivatedSkill(env, '회피')).toBe(true);
    });

    it('스킬을 비활성화할 수 있다', () => {
      const env = createBattleEnvironment();
      
      manager.activateSkill(env, '필살');
      manager.deactivateSkill(env, '필살');
      
      expect(manager.hasActivatedSkill(env, '필살')).toBe(false);
    });
  });

  describe('전투력 배율', () => {
    it('전투력 배율을 설정할 수 있다', () => {
      const env = createBattleEnvironment();
      
      manager.setWarPowerMultiplier(env, 1.5);
      
      expect(env.warPowerMultiplier).toBe(1.5);
    });

    it('전투력 배율을 곱할 수 있다', () => {
      const env = createBattleEnvironment();
      env.warPowerMultiplier = 2.0;
      
      manager.multiplyWarPowerMultiplier(env, 0.5);
      
      expect(env.warPowerMultiplier).toBe(1.0);
    });
  });
});

describe('RandomGenerator', () => {
  describe('SeededRandomGenerator', () => {
    it('동일 시드는 동일 결과를 반환한다', () => {
      const rng1 = new SeededRandomGenerator(12345);
      const rng2 = new SeededRandomGenerator(12345);
      
      expect(rng1.next()).toBe(rng2.next());
      expect(rng1.next()).toBe(rng2.next());
      expect(rng1.next()).toBe(rng2.next());
    });

    it('nextBool은 확률에 따라 true/false를 반환한다', () => {
      const rng = new SeededRandomGenerator(42);
      
      // 확률 1.0이면 항상 true
      expect(rng.nextBool(1.0)).toBe(true);
      
      // 확률 0.0이면 항상 false
      expect(rng.nextBool(0.0)).toBe(false);
    });

    it('nextRangeInt는 범위 내 정수를 반환한다', () => {
      const rng = new SeededRandomGenerator(42);
      
      for (let i = 0; i < 100; i++) {
        const value = rng.nextRangeInt(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });
});

describe('initializeAllTriggers', () => {
  it('모든 기본 트리거를 등록한다', () => {
    const manager = new TriggerManager();
    initializeAllTriggers(manager);
    
    const allTriggers = manager.getAllTriggers();
    expect(allTriggers.length).toBeGreaterThan(30);
  });

  it('트리거 통계를 반환한다', () => {
    const stats = getTriggerStats();
    
    expect(stats.total).toBeGreaterThan(30);
    expect(stats.byCategory.attack).toBeGreaterThan(0);
    expect(stats.byCategory.defense).toBeGreaterThan(0);
    expect(stats.byCategory.tactics).toBeGreaterThan(0);
    expect(stats.byCategory.special).toBeGreaterThan(0);
  });
});

// ============================================================================
// 테스트 헬퍼
// ============================================================================

function createTestContext(): TriggerContext {
  const attacker = createMockUnit({ id: 'attacker', side: 'attacker' });
  const defender = createMockUnit({ id: 'defender', side: 'defender' });
  const battleState = createMockBattleState();
  
  return {
    battleId: 'test',
    turn: 1,
    phase: 0,
    maxPhase: 3,
    self: attacker,
    oppose: defender,
    selfEnv: createBattleEnvironment(),
    opposeEnv: createBattleEnvironment(),
    isAttacker: true,
    damageCalculator: {} as any,
    battleState,
    rng: new DefaultRandomGenerator(),
    logs: [],
  };
}

// 테스트용 트리거 클래스들
class TestTrigger extends BaseTrigger {
  id = 'test_trigger';
  name = '테스트';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.NORMAL;
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered({ effects: ['test'] });
  }
}

class ConditionalTrigger extends BaseTrigger {
  id = 'conditional_trigger';
  name = '조건부';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.NORMAL;
  
  constructor(private shouldTrigger: boolean) {
    super();
  }
  
  condition(ctx: TriggerContext): boolean {
    return this.shouldTrigger;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered();
  }
}

class PriorityTrigger extends BaseTrigger {
  id: string;
  name = '우선순위';
  timing: TriggerTiming = 'before_attack';
  
  constructor(public priority: number, public label: string) {
    super();
    this.id = `priority_${priority}`;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.triggered({ effects: [this.label] });
  }
}

class StopChainTrigger extends BaseTrigger {
  id = 'stop_chain';
  name = '체인중단';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.BEGIN;
  
  execute(ctx: TriggerContext): TriggerResult {
    return this.stopChain();
  }
}


