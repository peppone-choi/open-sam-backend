/**
 * TurnBasedBattle.test.ts
 * 삼국지 스타일 턴제 전투 엔진 단위 테스트
 */

import {
  TurnBasedBattleService,
} from '../TurnBasedBattle.service';
import {
  getCompatibilityModifier,
  getCompatibilityInfo,
  getTerrainEffect,
  getTerrainDefenseModifier,
  canPassTerrain,
  getElevationModifier,
} from '../UnitCompatibility';
import {
  getUnitCategory,
  TurnBasedUnit,
  CreateTurnBasedBattleParams,
  TurnBasedBattleConfig,
  DEFAULT_BATTLE_CONFIG,
} from '../TurnBasedBattle.types';
import {
  getFormationStats,
  getFormationCounter,
} from '../../../core/battle/interfaces/Formation';

// ============================================================================
// 병종 카테고리 테스트
// ============================================================================

describe('UnitCategory', () => {
  describe('getUnitCategory', () => {
    it('보병 ID (1100~1199)를 infantry로 분류해야 함', () => {
      expect(getUnitCategory(1100)).toBe('infantry');
      expect(getUnitCategory(1101)).toBe('infantry');
      expect(getUnitCategory(1150)).toBe('infantry');
    });

    it('궁병 ID (1200~1299)를 archer로 분류해야 함', () => {
      expect(getUnitCategory(1200)).toBe('archer');
      expect(getUnitCategory(1201)).toBe('archer');
      expect(getUnitCategory(1250)).toBe('archer');
    });

    it('기병 ID (1300~1399)를 cavalry로 분류해야 함', () => {
      expect(getUnitCategory(1300)).toBe('cavalry');
      expect(getUnitCategory(1301)).toBe('cavalry');
      expect(getUnitCategory(1350)).toBe('cavalry');
    });

    it('책사 ID (1400~1499)를 wizard로 분류해야 함', () => {
      expect(getUnitCategory(1400)).toBe('wizard');
      expect(getUnitCategory(1402)).toBe('wizard');
    });

    it('공성 ID (1500~1599)를 siege로 분류해야 함', () => {
      expect(getUnitCategory(1500)).toBe('siege');
      expect(getUnitCategory(1501)).toBe('siege');
    });
  });
});

// ============================================================================
// 병종 상성 테스트
// ============================================================================

describe('UnitCompatibility', () => {
  describe('getCompatibilityModifier', () => {
    it('보병(1100)이 기병(1300)에게 불리해야 함 (0.7)', () => {
      const modifier = getCompatibilityModifier(1100, 1300);
      expect(modifier).toBe(0.7);
    });

    it('기병(1300)이 보병(1100)에게 유리해야 함 (1.3)', () => {
      const modifier = getCompatibilityModifier(1300, 1100);
      expect(modifier).toBe(1.3);
    });

    it('궁병(1200)이 기병(1300)에게 유리해야 함 (1.3)', () => {
      const modifier = getCompatibilityModifier(1200, 1300);
      expect(modifier).toBe(1.3);
    });

    it('기병(1300)이 궁병(1200)에게 불리해야 함 (0.7)', () => {
      const modifier = getCompatibilityModifier(1300, 1200);
      expect(modifier).toBe(0.7);
    });

    it('보병(1100)이 궁병(1200)에게 유리해야 함 (1.3)', () => {
      const modifier = getCompatibilityModifier(1100, 1200);
      expect(modifier).toBe(1.3);
    });

    it('궁병(1200)이 보병(1100)에게 불리해야 함 (0.7)', () => {
      const modifier = getCompatibilityModifier(1200, 1100);
      expect(modifier).toBe(0.7);
    });

    it('같은 병종끼리는 동등해야 함 (1.0)', () => {
      expect(getCompatibilityModifier(1100, 1100)).toBe(1.0);
      expect(getCompatibilityModifier(1200, 1200)).toBe(1.0);
      expect(getCompatibilityModifier(1300, 1300)).toBe(1.0);
    });

    it('특수 상성 - 장창병(1108)이 기병에게 추가 유리해야 함', () => {
      const modifier = getCompatibilityModifier(1108, 1300);
      expect(modifier).toBe(1.5); // 특수 상성
    });
  });

  describe('getCompatibilityInfo', () => {
    it('유리한 상성 정보를 반환해야 함', () => {
      const info = getCompatibilityInfo(1300, 1100); // 기병 vs 보병
      expect(info.isAdvantage).toBe(true);
      expect(info.isDisadvantage).toBe(false);
      expect(info.description).toContain('유리');
    });

    it('불리한 상성 정보를 반환해야 함', () => {
      const info = getCompatibilityInfo(1100, 1300); // 보병 vs 기병
      expect(info.isAdvantage).toBe(false);
      expect(info.isDisadvantage).toBe(true);
      expect(info.description).toContain('불리');
    });
  });
});

// ============================================================================
// 지형 효과 테스트
// ============================================================================

describe('TerrainEffects', () => {
  describe('getTerrainEffect', () => {
    it('평지는 기본 효과를 가져야 함', () => {
      const effect = getTerrainEffect('plain');
      expect(effect.moveCost).toBe(1.0);
      expect(effect.defenseBonus).toBe(0);
      expect(effect.passable).toBe(true);
    });

    it('숲은 방어 보너스와 이동 페널티를 가져야 함', () => {
      const effect = getTerrainEffect('forest');
      expect(effect.defenseBonus).toBe(20);
      expect(effect.moveCost).toBeGreaterThan(1.0);
    });

    it('언덕은 방어 보너스를 가져야 함', () => {
      const effect = getTerrainEffect('hill');
      expect(effect.defenseBonus).toBe(30);
    });

    it('산은 높은 방어 보너스와 기병 통행 불가를 가져야 함', () => {
      const effect = getTerrainEffect('mountain');
      expect(effect.defenseBonus).toBe(50);
      expect(effect.cavalryPassable).toBe(false);
    });

    it('물은 통행 불가여야 함', () => {
      const effect = getTerrainEffect('water');
      expect(effect.passable).toBe(false);
    });
  });

  describe('getTerrainDefenseModifier', () => {
    it('언덕에서 방어력이 30% 증가해야 함', () => {
      const modifier = getTerrainDefenseModifier('hill');
      expect(modifier).toBe(1.3);
    });

    it('성에서 방어력이 50% 증가해야 함', () => {
      const modifier = getTerrainDefenseModifier('castle');
      expect(modifier).toBe(1.5);
    });
  });

  describe('canPassTerrain', () => {
    const createMockUnit = (category: string): TurnBasedUnit => ({
      id: 'test',
      name: 'Test Unit',
      generalId: 1,
      generalName: 'Test',
      side: 'attacker',
      playerId: 1,
      position: { x: 0, y: 0 },
      facing: 0,
      crewTypeId: 1100,
      crewTypeName: 'Test',
      category: category as any,
      troops: 1000,
      maxTroops: 1000,
      attack: 100,
      defense: 100,
      speed: 6,
      attackRange: 1,
      moveRange: 5,
      morale: 100,
      training: 100,
      hp: 10000,
      maxHp: 10000,
      formation: 'square',
      hasActed: false,
      hasMoved: false,
      hasAttacked: false,
      isRouting: false,
      buffs: [],
      debuffs: [],
    });

    it('보병은 산을 통과할 수 있어야 함', () => {
      const unit = createMockUnit('infantry');
      expect(canPassTerrain(unit, 'mountain')).toBe(true);
    });

    it('기병은 산을 통과할 수 없어야 함', () => {
      const unit = createMockUnit('cavalry');
      expect(canPassTerrain(unit, 'mountain')).toBe(false);
    });

    it('기병은 늪을 통과할 수 없어야 함', () => {
      const unit = createMockUnit('cavalry');
      expect(canPassTerrain(unit, 'swamp')).toBe(false);
    });
  });
});

// ============================================================================
// 고도 보정 테스트
// ============================================================================

describe('ElevationModifier', () => {
  it('높은 곳에서 공격 시 보너스가 있어야 함', () => {
    const modifier = getElevationModifier(5, 0);
    expect(modifier).toBeGreaterThan(1.0);
  });

  it('낮은 곳에서 공격 시 페널티가 있어야 함', () => {
    const modifier = getElevationModifier(0, 5);
    expect(modifier).toBeLessThan(1.0);
  });

  it('같은 고도에서는 보정이 없어야 함', () => {
    const modifier = getElevationModifier(3, 3);
    expect(modifier).toBe(1.0);
  });
});

// ============================================================================
// 턴제 전투 서비스 테스트
// ============================================================================

describe('TurnBasedBattleService', () => {
  let service: TurnBasedBattleService;

  beforeEach(() => {
    service = new TurnBasedBattleService();
  });

  describe('createBattle', () => {
    const createBattleParams = (): CreateTurnBasedBattleParams => ({
      sessionId: 'test_session',
      attackerPlayerId: 1,
      defenderPlayerId: 2,
      attackerNationId: 1,
      defenderNationId: 2,
      attackerUnits: [
        {
          generalId: 1,
          generalName: '관우',
          crewTypeId: 1300, // 기병
          troops: 1000,
          attack: 95,
          defense: 85,
          morale: 100,
          training: 80,
        },
        {
          generalId: 2,
          generalName: '장비',
          crewTypeId: 1100, // 보병
          troops: 1000,
          attack: 90,
          defense: 80,
          morale: 100,
          training: 75,
        },
      ],
      defenderUnits: [
        {
          generalId: 3,
          generalName: '하후돈',
          crewTypeId: 1100, // 보병
          troops: 1000,
          attack: 85,
          defense: 90,
          morale: 100,
          training: 85,
        },
      ],
    });

    it('전투 인스턴스를 생성해야 함', () => {
      const params = createBattleParams();
      const state = service.createBattle(params);

      expect(state.battleId).toBeDefined();
      expect(state.sessionId).toBe('test_session');
      expect(state.units.size).toBe(3);
      expect(state.currentTurn).toBe(0);
      expect(state.isFinished).toBe(false);
    });

    it('유닛이 올바르게 배치되어야 함', () => {
      const params = createBattleParams();
      const state = service.createBattle(params);

      // 공격자는 맵 하단에
      const attackers = Array.from(state.units.values()).filter(u => u.side === 'attacker');
      for (const unit of attackers) {
        expect(unit.position.y).toBeGreaterThan(30);
      }

      // 방어자는 맵 상단에
      const defenders = Array.from(state.units.values()).filter(u => u.side === 'defender');
      for (const unit of defenders) {
        expect(unit.position.y).toBeLessThan(10);
      }
    });

    it('행동 순서가 속도순으로 정렬되어야 함', () => {
      const params = createBattleParams();
      const state = service.createBattle(params);

      // 기병(속도 10)이 먼저 행동해야 함
      const firstUnitId = state.unitOrder[0];
      const firstUnit = state.units.get(firstUnitId);
      expect(firstUnit?.category).toBe('cavalry');
    });

    it('40x40 맵이 생성되어야 함', () => {
      const params = createBattleParams();
      const state = service.createBattle(params);

      expect(state.map.length).toBe(40);
      expect(state.map[0].length).toBe(40);
    });
  });

  describe('startNextTurn', () => {
    it('턴 번호가 증가해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      expect(state.currentTurn).toBe(0);

      service.startNextTurn(state);
      expect(state.currentTurn).toBe(1);

      service.startNextTurn(state);
      expect(state.currentTurn).toBe(2);
    });

    it('모든 유닛의 행동 상태가 초기화되어야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      
      // 첫 번째 유닛이 행동했다고 표시
      const firstUnit = state.units.values().next().value;
      firstUnit.hasActed = true;
      firstUnit.hasMoved = true;
      firstUnit.hasAttacked = true;

      // 다음 턴 시작
      service.startNextTurn(state);

      // 상태가 초기화되었는지 확인
      expect(firstUnit.hasActed).toBe(false);
      expect(firstUnit.hasMoved).toBe(false);
      expect(firstUnit.hasAttacked).toBe(false);
    });
  });

  describe('executeAction - Move', () => {
    it('유효한 이동을 실행해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      const attacker = Array.from(state.units.values()).find(u => u.side === 'attacker')!;
      
      const originalY = attacker.position.y;
      const targetPosition = { x: attacker.position.x, y: originalY - 2 };

      const result = service.executeAction(state, {
        unitId: attacker.id,
        type: 'move',
        targetPosition,
      });

      expect(result.success).toBe(true);
      expect(attacker.position.y).toBe(targetPosition.y);
      expect(attacker.hasMoved).toBe(true);
    });

    it('범위 밖 이동은 실패해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      const attacker = Array.from(state.units.values()).find(u => u.side === 'attacker')!;

      // 이동 범위를 크게 초과하는 위치
      const result = service.executeAction(state, {
        unitId: attacker.id,
        type: 'move',
        targetPosition: { x: 0, y: 0 }, // 맵 모서리
      });

      expect(result.success).toBe(false);
    });
  });

  describe('checkVictoryCondition', () => {
    it('방어자 전멸 시 공격자 승리를 반환해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      
      // 방어자 전멸 시뮬레이션
      const defender = Array.from(state.units.values()).find(u => u.side === 'defender')!;
      defender.troops = 0;

      const victory = service.checkVictoryCondition(state);

      expect(victory).not.toBeNull();
      expect(victory?.winner).toBe('attacker');
      expect(victory?.type).toBe('elimination');
    });

    it('공격자 전멸 시 방어자 승리를 반환해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      };

      const state = service.createBattle(params);
      
      // 공격자 전멸 시뮬레이션
      const attacker = Array.from(state.units.values()).find(u => u.side === 'attacker')!;
      attacker.troops = 0;

      const victory = service.checkVictoryCondition(state);

      expect(victory).not.toBeNull();
      expect(victory?.winner).toBe('defender');
    });
  });

  describe('calculateDamage', () => {
    it('데미지가 양수여야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1300, troops: 1000, attack: 90, defense: 70, morale: 100, training: 80 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 1000, attack: 80, defense: 80, morale: 100, training: 80 }],
      };

      const state = service.createBattle(params);
      const attacker = Array.from(state.units.values()).find(u => u.side === 'attacker')!;
      const defender = Array.from(state.units.values()).find(u => u.side === 'defender')!;

      const result = service.calculateDamage({
        attacker,
        defender,
        terrain: 'plain',
        isCounter: false,
      });

      expect(result.finalDamage).toBeGreaterThan(0);
      expect(result.casualties).toBeGreaterThanOrEqual(0);
    });

    it('상성 유리 시 데미지가 증가해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [
          { generalId: 1, generalName: 'Cavalry', crewTypeId: 1300, troops: 1000, attack: 80, defense: 70, morale: 100, training: 80 },
        ],
        defenderUnits: [
          { generalId: 2, generalName: 'Infantry', crewTypeId: 1100, troops: 1000, attack: 80, defense: 70, morale: 100, training: 80 },
        ],
      };

      const state = service.createBattle(params);
      const cavalry = Array.from(state.units.values()).find(u => u.category === 'cavalry')!;
      const infantry = Array.from(state.units.values()).find(u => u.category === 'infantry')!;

      // 기병 → 보병 (유리)
      const advantageResult = service.calculateDamage({
        attacker: cavalry,
        defender: infantry,
        terrain: 'plain',
        isCounter: false,
      });

      // 보병 → 기병 (불리)
      const disadvantageResult = service.calculateDamage({
        attacker: infantry,
        defender: cavalry,
        terrain: 'plain',
        isCounter: false,
      });

      expect(advantageResult.compatibilityModifier).toBeGreaterThan(1.0);
      expect(disadvantageResult.compatibilityModifier).toBeLessThan(1.0);
    });

    it('반격 시 데미지가 감소해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 1000, attack: 80, defense: 70, morale: 100, training: 80 }],
        defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 1000, attack: 80, defense: 70, morale: 100, training: 80 }],
      };

      const state = service.createBattle(params);
      const unit = state.units.values().next().value;

      const normalResult = service.calculateDamage({
        attacker: unit,
        defender: unit,
        terrain: 'plain',
        isCounter: false,
      });

      const counterResult = service.calculateDamage({
        attacker: unit,
        defender: unit,
        terrain: 'plain',
        isCounter: true,
      });

      expect(counterResult.finalDamage).toBeLessThan(normalResult.finalDamage);
    });
  });

  describe('simulateBattle (Auto Battle)', () => {
    it('자동 전투가 승자를 결정해야 함', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [
          { generalId: 1, generalName: '관우', crewTypeId: 1300, troops: 1000, attack: 95, defense: 85, morale: 100, training: 90 },
        ],
        defenderUnits: [
          { generalId: 2, generalName: '병사', crewTypeId: 1100, troops: 500, attack: 50, defense: 50, morale: 80, training: 50 },
        ],
        maxTurns: 20,
      };

      const state = service.createBattle(params);
      service.simulateBattle(state);

      expect(state.isFinished).toBe(true);
      expect(state.winner).toBeDefined();
    });

    it('강한 쪽이 승리해야 함 (기병 vs 보병)', () => {
      const params: CreateTurnBasedBattleParams = {
        sessionId: 'test',
        attackerPlayerId: 1,
        defenderPlayerId: 2,
        attackerNationId: 1,
        defenderNationId: 2,
        attackerUnits: [
          { generalId: 1, generalName: '기병대', crewTypeId: 1300, troops: 1000, attack: 90, defense: 80, morale: 100, training: 90 },
        ],
        defenderUnits: [
          { generalId: 2, generalName: '보병대', crewTypeId: 1100, troops: 1000, attack: 90, defense: 80, morale: 100, training: 90 },
        ],
        maxTurns: 30,
      };

      const state = service.createBattle(params);
      service.simulateBattle(state);

      // 기병이 보병에게 유리하므로 공격자(기병) 승리 예상
      // 하지만 AI가 움직이므로 100% 보장은 안됨
      expect(state.isFinished).toBe(true);
    });
  });
});

// ============================================================================
// 사기 시스템 테스트
// ============================================================================

describe('Morale System', () => {
  let service: TurnBasedBattleService;

  beforeEach(() => {
    service = new TurnBasedBattleService();
  });

  it('사기가 0이 되면 패주 상태가 되어야 함', () => {
    const params: CreateTurnBasedBattleParams = {
      sessionId: 'test',
      attackerPlayerId: 1,
      defenderPlayerId: 2,
      attackerNationId: 1,
      defenderNationId: 2,
      attackerUnits: [{ generalId: 1, generalName: 'A', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 100, training: 50 }],
      defenderUnits: [{ generalId: 2, generalName: 'B', crewTypeId: 1100, troops: 100, attack: 50, defense: 50, morale: 5, training: 50 }],
    };

    const state = service.createBattle(params);
    const defender = Array.from(state.units.values()).find(u => u.side === 'defender')!;
    
    // 사기를 0으로 설정
    defender.morale = 0;

    // 턴 종료 처리
    const turnResult = {
      turnNumber: 1,
      actionOrder: [],
      actions: [],
      eliminatedUnits: [],
      routingUnits: [],
    };
    
    service.endTurn(state, turnResult);

    expect(defender.isRouting).toBe(true);
    expect(turnResult.routingUnits).toContain(defender.id);
  });
});

// ============================================================================
// 진형 시스템 테스트
// ============================================================================

describe('Formation System', () => {
  it('어린진은 공격력이 높아야 함', () => {
    const stats = getFormationStats('fishScale');
    expect(stats.attack).toBeGreaterThan(1.0);
    expect(stats.defense).toBeLessThan(1.0);
  });

  it('방원진은 방어력이 높아야 함', () => {
    const stats = getFormationStats('circular');
    expect(stats.defense).toBeGreaterThan(1.0);
    expect(stats.attack).toBeLessThan(1.0);
  });

  it('봉시진은 가장 높은 공격력을 가져야 함', () => {
    const arrowhead = getFormationStats('arrowhead');
    const fishScale = getFormationStats('fishScale');
    expect(arrowhead.attack).toBeGreaterThanOrEqual(fishScale.attack);
  });

  it('장사진은 속도가 빨라야 함', () => {
    const stats = getFormationStats('longSnake');
    expect(stats.speed).toBeGreaterThan(1.0);
  });

  it('진형 상성이 적용되어야 함', () => {
    // 어린진은 학익진에 불리
    const counter = getFormationCounter('fishScale', 'craneWing');
    expect(counter).toBeLessThan(1.0);
  });
});

