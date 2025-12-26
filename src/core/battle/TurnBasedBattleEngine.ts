/**
 * TurnBasedBattleEngine - 삼국지 스타일 턴제 전투 엔진
 * 
 * 기존 BattleEngine과 달리 순수 턴제 방식으로 동작
 * - 속도순 행동 결정
 * - 이동 → 공격 → 반격 → 턴 종료
 * - 사기 0이면 패주
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BattleState,
  BattleUnit3D,
  Position3D,
  Action,
  BattleTile3D,
  VictoryCondition,
  UnitType,
} from './types';
import { BattleValidator } from './BattleValidator';
import {
  Formation,
  FORMATION_STATS,
  getFormationStats,
  getFormationCounter,
} from './interfaces/Formation';

// ============================================================================
// 설정
// ============================================================================

export interface TurnBasedConfig {
  maxTurns: number;           // 최대 턴 수
  gridSize: number;           // 그리드 크기 (40x40)
  criticalChance: number;     // 치명타 확률 (%)
  moraleRouteThreshold: number; // 패주 사기 임계값
  counterAttackEnabled: boolean;
  formationEnabled: boolean;
}

export const DEFAULT_TURN_CONFIG: TurnBasedConfig = {
  maxTurns: 50,
  gridSize: 40,
  criticalChance: 10,
  moraleRouteThreshold: 0,
  counterAttackEnabled: true,
  formationEnabled: true,
};

// ============================================================================
// 병종 상성 시스템
// ============================================================================

/**
 * 병종 상성 테이블
 * 보병(FOOTMAN) < 기병(CAVALRY) < 궁병(ARCHER) < 보병
 */
const UNIT_COMPATIBILITY: Record<UnitType, Record<UnitType, number>> = {
  [UnitType.FOOTMAN]: {
    [UnitType.FOOTMAN]: 1.0,
    [UnitType.CAVALRY]: 0.7,   // 보병은 기병에게 불리
    [UnitType.ARCHER]: 1.3,    // 보병은 궁병에게 유리
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 1.1,
  },
  [UnitType.CAVALRY]: {
    [UnitType.FOOTMAN]: 1.3,   // 기병은 보병에게 유리
    [UnitType.CAVALRY]: 1.0,
    [UnitType.ARCHER]: 0.7,    // 기병은 궁병에게 불리
    [UnitType.WIZARD]: 1.2,
    [UnitType.SIEGE]: 1.5,
  },
  [UnitType.ARCHER]: {
    [UnitType.FOOTMAN]: 0.7,   // 궁병은 보병에게 불리
    [UnitType.CAVALRY]: 1.3,   // 궁병은 기병에게 유리
    [UnitType.ARCHER]: 1.0,
    [UnitType.WIZARD]: 0.9,
    [UnitType.SIEGE]: 0.9,
  },
  [UnitType.WIZARD]: {
    [UnitType.FOOTMAN]: 1.0,
    [UnitType.CAVALRY]: 0.8,
    [UnitType.ARCHER]: 1.1,
    [UnitType.WIZARD]: 1.0,
    [UnitType.SIEGE]: 0.9,
  },
  [UnitType.SIEGE]: {
    [UnitType.FOOTMAN]: 0.9,
    [UnitType.CAVALRY]: 0.5,
    [UnitType.ARCHER]: 1.0,
    [UnitType.WIZARD]: 1.1,
    [UnitType.SIEGE]: 1.0,
  },
};

/**
 * 상성 배수 조회
 */
function getCompatibilityModifier(attacker: UnitType, defender: UnitType): number {
  return UNIT_COMPATIBILITY[attacker]?.[defender] ?? 1.0;
}

// ============================================================================
// 진형 보정 시스템
// ============================================================================

/**
 * 삼국지 진형 타입 (간소화)
 */
export type SangokuFormation =
  | 'fishScale'   // 어린진 - 공격 +20%, 방어 -10%
  | 'craneWing'   // 학익진 - 균형
  | 'circular'    // 방원진 - 방어 +30%, 공격 -10%
  | 'arrowhead'   // 봉시진 - 공격 +30%, 방어 -20%
  | 'longSnake';  // 장사진 - 속도 +30%, 균형

/**
 * 진형 보너스
 */
const FORMATION_BONUS: Record<SangokuFormation, { attack: number; defense: number; speed: number }> = {
  fishScale: { attack: 1.2, defense: 0.9, speed: 1.0 },
  craneWing: { attack: 1.1, defense: 1.0, speed: 0.9 },
  circular: { attack: 0.9, defense: 1.3, speed: 0.8 },
  arrowhead: { attack: 1.3, defense: 0.8, speed: 1.2 },
  longSnake: { attack: 1.0, defense: 1.0, speed: 1.3 },
};

/**
 * 진형 보정 조회
 */
function getFormationBonus(formation: SangokuFormation, stat: 'attack' | 'defense' | 'speed'): number {
  return FORMATION_BONUS[formation]?.[stat] ?? 1.0;
}

// ============================================================================
// 턴제 전투 엔진
// ============================================================================

export interface TurnBasedBattleUnit extends BattleUnit3D {
  formation: SangokuFormation;
  hasMoved: boolean;
  hasAttacked: boolean;
  isRouting: boolean;
}

export interface TurnResult {
  turnNumber: number;
  actionOrder: string[];
  actions: ActionResult[];
  eliminatedUnits: string[];
  routingUnits: string[];
  winner?: 'attacker' | 'defender';
}

export interface ActionResult {
  unitId: string;
  actionType: string;
  success: boolean;
  damage?: number;
  counterDamage?: number;
  casualties?: number;
  effects: string[];
}

export interface TurnBasedBattleState {
  battleId: string;
  currentTurn: number;
  maxTurns: number;
  phase: 'waiting' | 'active' | 'finished';
  weather: 'clear' | 'rain' | 'wind' | 'snow' | 'heat';
  tileEffects: Map<string, { type: 'fire' | 'pit' | 'rubble'; duration: number; value: number }>;

  map: BattleTile3D[][];
  units: Map<string, TurnBasedBattleUnit>;

  attackerPlayerId: number;
  defenderPlayerId: number;

  actionOrder: string[];
  activeUnitIndex: number;

  winner?: 'attacker' | 'defender' | 'draw';
  battleLog: string[];
  turnHistory: TurnResult[];
}

export class TurnBasedBattleEngine {
  private config: TurnBasedConfig;
  private validator: BattleValidator;

  constructor(config: Partial<TurnBasedConfig> = {}) {
    this.config = { ...DEFAULT_TURN_CONFIG, ...config };
    this.validator = new BattleValidator();
  }

  // ==========================================================================
  // 전투 생성
  // ==========================================================================

  /**
   * 전투 시작
   */
  startBattle(
    battleId: string,
    map: BattleTile3D[][],
    attackerUnits: BattleUnit3D[],
    defenderUnits: BattleUnit3D[],
    attackerPlayerId: number,
    defenderPlayerId: number
  ): TurnBasedBattleState {
    const units = new Map<string, TurnBasedBattleUnit>();

    // 공격자 유닛 추가
    for (const unit of attackerUnits) {
      const tbUnit = this.convertToTurnBasedUnit(unit, 'fishScale');
      units.set(tbUnit.id, tbUnit);
    }

    // 방어자 유닛 추가
    for (const unit of defenderUnits) {
      const tbUnit = this.convertToTurnBasedUnit(unit, 'circular');
      units.set(tbUnit.id, tbUnit);
    }

    const actionOrder = this.calculateActionOrder(units);

    return {
      battleId,
      currentTurn: 0,
      maxTurns: this.config.maxTurns,
      phase: 'waiting',
      weather: 'clear',
      tileEffects: new Map(),
      map,
      units,
      attackerPlayerId,
      defenderPlayerId,
      actionOrder,
      activeUnitIndex: 0,
      battleLog: [`Battle ${battleId} initialized`],
      turnHistory: [],
    };
  }

  /**
   * 유닛을 턴제 유닛으로 변환
   */
  private convertToTurnBasedUnit(
    unit: BattleUnit3D,
    formation: SangokuFormation
  ): TurnBasedBattleUnit {
    return {
      ...unit,
      formation,
      hasMoved: false,
      hasAttacked: false,
      isRouting: false,
    };
  }

  /**
   * 행동 순서 계산 (속도 내림차순)
   */
  private calculateActionOrder(units: Map<string, TurnBasedBattleUnit>): string[] {
    const unitList = Array.from(units.values())
      .filter(u => u.hp > 0 && !u.isRouting);

    // 속도순 정렬 (진형 보정 포함)
    unitList.sort((a, b) => {
      const speedA = a.speed * getFormationBonus(a.formation, 'speed');
      const speedB = b.speed * getFormationBonus(b.formation, 'speed');
      return speedB - speedA;
    });

    return unitList.map(u => u.id);
  }

  // ==========================================================================
  // 턴 처리
  // ==========================================================================

  /**
   * 턴 시작
   */
  startTurn(state: TurnBasedBattleState): TurnResult {
    state.currentTurn++;
    state.phase = 'active';
    state.activeUnitIndex = 0;

    // 유닛 상태 초기화
    for (const unit of state.units.values()) {
      unit.hasActed = false;
      unit.hasMoved = false;
      unit.hasAttacked = false;
    }

    // 행동 순서 재계산
    state.actionOrder = this.calculateActionOrder(state.units);

    state.battleLog.push(`=== Turn ${state.currentTurn} Start ===`);
    state.battleLog.push(`Action order: ${state.actionOrder.map(id => state.units.get(id)?.name).join(' -> ')}`);

    return {
      turnNumber: state.currentTurn,
      actionOrder: [...state.actionOrder],
      actions: [],
      eliminatedUnits: [],
      routingUnits: [],
    };
  }

  /**
   * 현재 행동할 유닛
   */
  getCurrentUnit(state: TurnBasedBattleState): TurnBasedBattleUnit | null {
    if (state.activeUnitIndex >= state.actionOrder.length) {
      return null;
    }
    const unitId = state.actionOrder[state.activeUnitIndex];
    return state.units.get(unitId) ?? null;
  }

  /**
   * 다음 유닛으로
   */
  nextUnit(state: TurnBasedBattleState): TurnBasedBattleUnit | null {
    state.activeUnitIndex++;

    while (state.activeUnitIndex < state.actionOrder.length) {
      const unit = this.getCurrentUnit(state);
      if (unit && unit.hp > 0 && !unit.isRouting) {
        return unit;
      }
      state.activeUnitIndex++;
    }

    return null;
  }

  /**
   * 이동 실행
   */
  executeMove(
    state: TurnBasedBattleState,
    unitId: string,
    targetPos: Position3D
  ): ActionResult {
    const unit = state.units.get(unitId);
    if (!unit) {
      return { unitId, actionType: 'move', success: false, effects: ['Unit not found'] };
    }

    if (unit.hasMoved) {
      return { unitId, actionType: 'move', success: false, effects: ['Already moved'] };
    }

    // 이동 검증
    const validation = this.validator.canMove(unit, targetPos, state.map, state.units as unknown as Map<string, BattleUnit3D>);
    if (!validation.valid) {
      return { unitId, actionType: 'move', success: false, effects: [validation.reason ?? 'Cannot move'] };
    }

    // 이동 실행
    unit.position = { ...targetPos };
    unit.hasMoved = true;

    const effect = `${unit.name} moved to (${targetPos.x}, ${targetPos.y})`;
    state.battleLog.push(effect);

    return { unitId, actionType: 'move', success: true, effects: [effect] };
  }

  /**
   * 공격 실행
   */
  executeAttack(
    state: TurnBasedBattleState,
    attackerId: string,
    targetId: string
  ): ActionResult {
    const attacker = state.units.get(attackerId);
    const defender = state.units.get(targetId);

    if (!attacker || !defender) {
      return { unitId: attackerId, actionType: 'attack', success: false, effects: ['Unit not found'] };
    }

    if (attacker.hasAttacked) {
      return { unitId: attackerId, actionType: 'attack', success: false, effects: ['Already attacked'] };
    }

    if (attacker.side === defender.side) {
      return { unitId: attackerId, actionType: 'attack', success: false, effects: ['Cannot attack ally'] };
    }

    // 공격 검증
    const validation = this.validator.canAttack(attacker, defender, state.map);
    if (!validation.valid) {
      return { unitId: attackerId, actionType: 'attack', success: false, effects: [validation.reason ?? 'Cannot attack'] };
    }

    // 데미지 계산
    const damageResult = this.calculateDamage(attacker, defender, false);

    // 피해 적용
    defender.hp -= damageResult.damage;
    defender.troops = Math.max(0, defender.troops - damageResult.casualties);

    // 사기 감소
    const moraleLoss = Math.floor(damageResult.casualties / 10);
    defender.morale = Math.max(0, defender.morale - moraleLoss);

    attacker.hasAttacked = true;
    attacker.hasActed = true;

    const effects: string[] = [
      `${attacker.name} attacks ${defender.name}!`,
      `Damage: ${damageResult.damage} (${damageResult.description})`,
      `${defender.name}: ${damageResult.casualties} casualties, Morale -${moraleLoss}`,
    ];

    // 반격 처리
    let counterDamage = 0;
    if (this.config.counterAttackEnabled && defender.hp > 0 && !defender.isRouting) {
      const distance = this.validator.getDistance3D(defender.position, attacker.position);
      if (distance <= defender.attackRange) {
        const counterResult = this.calculateDamage(defender, attacker, true);
        counterDamage = counterResult.damage;

        attacker.hp -= counterResult.damage;
        attacker.troops = Math.max(0, attacker.troops - counterResult.casualties);

        const attackerMoraleLoss = Math.floor(counterResult.casualties / 15);
        attacker.morale = Math.max(0, attacker.morale - attackerMoraleLoss);

        effects.push(
          `${defender.name} counter-attacks!`,
          `Counter damage: ${counterResult.damage}`,
          `${attacker.name}: ${counterResult.casualties} casualties`,
        );
      }
    }

    state.battleLog.push(effects.join(' | '));

    return {
      unitId: attackerId,
      actionType: 'attack',
      success: true,
      damage: damageResult.damage,
      counterDamage,
      casualties: damageResult.casualties,
      effects,
    };
  }

  /**
   * 데미지 계산
   * 공식: (공격력 × 병사수비율 × 상성보정 × 진형보정) - 방어력
   */
  private calculateDamage(
    attacker: TurnBasedBattleUnit,
    defender: TurnBasedBattleUnit,
    isCounter: boolean
  ): { damage: number; casualties: number; description: string } {
    // 기본 공격력
    let attackPower = attacker.strength;

    // 반격 시 감소
    if (isCounter) {
      attackPower *= 0.6;
    }

    // 병사수 비율
    const troopRatio = attacker.troops / attacker.maxTroops;

    // 상성 보정
    const compatibility = getCompatibilityModifier(attacker.unitType, defender.unitType);

    // 진형 보정
    let formationMod = 1.0;
    if (this.config.formationEnabled) {
      formationMod = getFormationBonus(attacker.formation, 'attack');
    }

    // 치명타
    let critMod = 1.0;
    let critDesc = '';
    if (Math.random() * 100 < this.config.criticalChance) {
      critMod = 1.5;
      critDesc = ' [CRIT!]';
    }

    // 기본 피해
    const baseDamage = attackPower * troopRatio * compatibility * formationMod * critMod;

    // 방어력 적용
    let defenseValue = defender.training;
    if (this.config.formationEnabled) {
      defenseValue *= getFormationBonus(defender.formation, 'defense');
    }
    const defenseReduction = defenseValue * 0.3;

    const finalDamage = Math.max(1, Math.floor(baseDamage - defenseReduction));
    const casualties = Math.floor(finalDamage / 10);

    // 설명 생성
    let description = `Base: ${Math.floor(baseDamage)}`;
    if (compatibility > 1.0) description += ' (Advantage)';
    if (compatibility < 1.0) description += ' (Disadvantage)';
    description += critDesc;

    return { damage: finalDamage, casualties, description };
  }

  /**
   * 방어 실행
   */
  executeDefend(state: TurnBasedBattleState, unitId: string): ActionResult {
    const unit = state.units.get(unitId);
    if (!unit) {
      return { unitId, actionType: 'defend', success: false, effects: ['부대를 찾을 수 없습니다.'] };
    }

    unit.hasActed = true;

    unit.buffs = unit.buffs ?? [];
    unit.buffs.push({ type: 'defense', value: 30, duration: 1 });

    const effect = `${unit.name} 부대가 방어 태세를 갖췄습니다. (1턴 간 방어력 +30%)`;
    state.battleLog.push(effect);

    return { unitId, actionType: 'defend', success: true, effects: [effect] };
  }

  /**
   * 화공 실행
   */
  executeFire(state: TurnBasedBattleState, unitId: string, targetPos: Position3D): ActionResult {
    const unit = state.units.get(unitId);
    if (!unit) return { unitId, actionType: 'fire', success: false, effects: ['부대 없음'] };

    const successProb = 30 + (unit.intelligence - 50); // 간단한 확률 공식
    const isSuccess = Math.random() * 100 < successProb;

    if (isSuccess) {
      const key = `${targetPos.x},${targetPos.y}`;
      state.tileEffects.set(key, { type: 'fire', duration: 3, value: 50 });
      const effect = `${unit.name} 부대가 (${targetPos.x}, ${targetPos.y})에 불을 질렀습니다!`;
      state.battleLog.push(effect);
      unit.hasActed = true;
      return { unitId, actionType: 'fire', success: true, effects: [effect] };
    } else {
      const effect = `${unit.name} 부대의 화공이 실패했습니다.`;
      state.battleLog.push(effect);
      unit.hasActed = true;
      return { unitId, actionType: 'fire', success: false, effects: [effect] };
    }
  }

  /**
   * 매복 실행
   */
  executeAmbush(state: TurnBasedBattleState, unitId: string): ActionResult {
    const unit = state.units.get(unitId);
    if (!unit) return { unitId, actionType: 'ambush', success: false, effects: ['부대 없음'] };

    unit.buffs = unit.buffs ?? [];
    unit.buffs.push({ type: 'hidden', value: 1, duration: 99 }); // 공격하거나 발견될 때까지 유지

    const effect = `${unit.name} 부대가 매복 상태에 들어갔습니다.`;
    state.battleLog.push(effect);
    unit.hasActed = true;
    return { unitId, actionType: 'ambush', success: true, effects: [effect] };
  }

  /**
   * 일기토 실행
   */
  executeDuel(state: TurnBasedBattleState, attackerId: string, defenderId: string): ActionResult {
    const attacker = state.units.get(attackerId);
    const defender = state.units.get(defenderId);
    if (!attacker || !defender) return { unitId: attackerId, actionType: 'duel', success: false, effects: ['대상 없음'] };

    const effect = `${attacker.name}가 ${defender.name}에게 일기토를 신청했습니다!`;
    state.battleLog.push(effect);

    // 단순 무력 비교 승률 (70% 기본 + 무력 차이)
    const winProb = 50 + (attacker.strength - defender.strength);
    const roll = Math.random() * 100;

    attacker.hasActed = true;

    if (roll < winProb) {
      const damage = Math.floor(defender.hp * 0.3);
      defender.hp -= damage;
      defender.morale = Math.max(0, defender.morale - 30);
      const res = `${attacker.name}가 일기토에서 승리했습니다! ${defender.name} 사취 저하 및 피해 발생.`;
      state.battleLog.push(res);
      return { unitId: attackerId, actionType: 'duel', success: true, effects: [effect, res] };
    } else {
      attacker.morale = Math.max(0, attacker.morale - 20);
      const res = `${attacker.name}가 일기토에서 패배하거나 거절당했습니다. 사기가 저하됩니다.`;
      state.battleLog.push(res);
      return { unitId: attackerId, actionType: 'duel', success: false, effects: [effect, res] };
    }
  }

  /**
   * 계략 실행 (위보, 반목, 혼란 공통)
   */
  executeTactic(state: TurnBasedBattleState, unitId: string, targetId: string, type: string): ActionResult {
    const unit = state.units.get(unitId);
    const target = state.units.get(targetId);
    if (!unit || !target) return { unitId, actionType: type, success: false, effects: ['대상 없음'] };

    const successProb = 40 + (unit.intelligence - target.intelligence);
    const isSuccess = Math.random() * 100 < successProb;

    unit.hasActed = true;

    if (isSuccess) {
      target.debuffs = target.debuffs ?? [];
      target.debuffs.push({ type: 'confused', value: 1, duration: 2 });
      const effect = `${unit.name}의 ${type} 계략이 적축! ${target.name} 부대가 혼란에 빠졌습니다.`;
      state.battleLog.push(effect);
      return { unitId: unit.id, actionType: type, success: true, effects: [effect] };
    } else {
      const effect = `${unit.name}의 ${type} 계략이 실패했습니다.`;
      state.battleLog.push(effect);
      return { unitId: unit.id, actionType: type, success: false, effects: [effect] };
    }
  }

  /**
   * 턴 종료
   */
    state.turnHistory.push(turnResult);

  // 타일 효과 처리 (화재 등)
  for(const [key, effect] of state.tileEffects) {
    const [tx, ty] = key.split(',').map(Number);
    // 해당 타일에 있는 부대 피해
    const occupant = Array.from(state.units.values()).find(u => u.position.x === tx && u.position.y === ty);
    if (occupant && effect.type === 'fire') {
      const damage = Math.floor(occupant.hp * 0.05) + 10;
      occupant.hp -= damage;
      state.battleLog.push(`화염 피해! ${occupant.name} 부대가 ${damage}의 피해를 입었습니다.`);
    }

    effect.duration--;
    if (effect.duration <= 0) {
      state.tileEffects.delete(key);
      state.battleLog.push(`(${tx}, ${ty})의 ${effect.type} 효과가 소멸했습니다.`);
    }
  }

  // 부대 버프/디버프 갱신
  for(const unit of state.units.values()) {
  if (unit.buffs) {
    unit.buffs = unit.buffs.filter(b => {
      b.duration--;
      return b.duration > 0 || b.duration === 99; // 99는 무한(매복 등)
    });
  }
  if (unit.debuffs) {
    unit.debuffs = unit.debuffs.filter(d => {
      d.duration--;
      return d.duration > 0;
    });
  }
}

return victory;
  }

  /**
   * 승리 조건 체크
   */
  private checkVictory(state: TurnBasedBattleState): VictoryCondition | null {
  const attackers = Array.from(state.units.values())
    .filter(u => u.side === 'attacker' && u.hp > 0 && !u.isRouting);
  const defenders = Array.from(state.units.values())
    .filter(u => u.side === 'defender' && u.hp > 0 && !u.isRouting);

  if (attackers.length === 0) {
    return { type: 'elimination', winner: 'defender', reason: 'All attackers eliminated' };
  }

  if (defenders.length === 0) {
    return { type: 'elimination', winner: 'attacker', reason: 'All defenders eliminated' };
  }

  if (state.currentTurn >= state.maxTurns) {
    const attackerTroops = attackers.reduce((sum, u) => sum + u.troops, 0);
    const defenderTroops = defenders.reduce((sum, u) => sum + u.troops, 0);

    if (attackerTroops > defenderTroops * 1.5) {
      return { type: 'time_limit', winner: 'attacker', reason: 'Turn limit (attacker advantage)' };
    }
    return { type: 'time_limit', winner: 'defender', reason: 'Turn limit (defense success)' };
  }

  return null;
}

// ==========================================================================
// 자동 전투
// ==========================================================================

/**
 * 자동 전투 시뮬레이션
 */
simulateBattle(state: TurnBasedBattleState): TurnBasedBattleState {
  while (state.phase !== 'finished' && state.currentTurn < state.maxTurns) {
    const turnResult = this.startTurn(state);

    let currentUnit = this.getCurrentUnit(state);
    while (currentUnit) {
      const action = this.decideAIAction(state, currentUnit);
      turnResult.actions.push(action);
      currentUnit = this.nextUnit(state);
    }

    const victory = this.endTurn(state, turnResult);
    if (victory) break;
  }

  return state;
}

  /**
   * AI 행동 결정
   */
  private decideAIAction(
  state: TurnBasedBattleState,
  unit: TurnBasedBattleUnit
): ActionResult {
  // 공격 가능한 적 찾기
  const enemies = Array.from(state.units.values())
    .filter(u => u.side !== unit.side && u.hp > 0 && !u.isRouting);

  for (const enemy of enemies) {
    const distance = this.validator.getDistance3D(unit.position, enemy.position);
    if (distance <= unit.attackRange) {
      return this.executeAttack(state, unit.id, enemy.id);
    }
  }

  // 이동 가능하면 가장 가까운 적에게 이동
  if (!unit.hasMoved && enemies.length > 0) {
    const closest = enemies.reduce((a, b) =>
      this.validator.getDistance3D(unit.position, a.position) <
        this.validator.getDistance3D(unit.position, b.position) ? a : b
    );

    // 적을 향해 이동
    const dx = Math.sign(closest.position.x - unit.position.x);
    const dy = Math.sign(closest.position.y - unit.position.y);
    const newPos: Position3D = {
      x: unit.position.x + dx * Math.min(unit.speed, 3),
      y: unit.position.y + dy * Math.min(unit.speed, 3),
      z: unit.position.z,
    };

    return this.executeMove(state, unit.id, newPos);
  }

  // 방어
  return this.executeDefend(state, unit.id);
}

// ==========================================================================
// 유틸리티
// ==========================================================================

/**
 * 전투 상태 조회
 */
getState(state: TurnBasedBattleState): TurnBasedBattleState {
  return state;
}

/**
 * 전투 로그 조회
 */
getBattleLog(state: TurnBasedBattleState): string[] {
  return state.battleLog;
}

/**
 * 진형 변경
 */
changeFormation(
  state: TurnBasedBattleState,
  unitId: string,
  newFormation: SangokuFormation
): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;

  // 진형 변경에 필요한 최소 사기
  const requiredMorale: Record<SangokuFormation, number> = {
    fishScale: 30,
    craneWing: 40,
    circular: 20,
    arrowhead: 35,
    longSnake: 25,
  };

  if (unit.morale < requiredMorale[newFormation]) {
    state.battleLog.push(`${unit.name} cannot change formation (low morale)`);
    return false;
  }

  unit.formation = newFormation;
  state.battleLog.push(`${unit.name} changed formation to ${newFormation}`);
  return true;
}
}




