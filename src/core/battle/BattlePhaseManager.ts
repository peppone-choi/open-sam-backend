/**
 * BattlePhaseManager - 전투 페이즈 관리 시스템
 * 
 * PHP WarUnit.php의 페이즈 관리 로직을 TypeScript로 변환
 * Agent D, G가 이 모듈을 사용합니다.
 * 
 * @module core/battle/BattlePhaseManager
 */

import { BattleUnit3D, UnitType, BattleState } from './types';
import { DamageCalculator, DamageResult, CombatContext } from './DamageCalculator';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 전투 페이즈 타입
 */
export type CombatPhaseType = 
  | 'initiative'      // 선제 판정
  | 'ranged'          // 원거리 공격
  | 'melee'           // 근접 공격
  | 'tactics'         // 계략 발동
  | 'retreat'         // 퇴각 판정
  | 'resolution';     // 결과 처리

/**
 * 페이즈 실행 결과
 */
export interface PhaseResult {
  phase: CombatPhaseType;
  actions: PhaseAction[];
  casualties: Map<string, number>;
  moraleLosses: Map<string, number>;
  events: BattleEvent[];
  nextPhase: CombatPhaseType | null;
  isComplete: boolean;
}

/**
 * 페이즈 내 개별 액션
 */
export interface PhaseAction {
  unitId: string;
  type: 'attack' | 'skill' | 'move' | 'retreat' | 'special';
  targetId?: string;
  damage?: DamageResult;
  success: boolean;
  message: string;
}

/**
 * 전투 이벤트
 */
export interface BattleEvent {
  type: 'critical' | 'evade' | 'skill_trigger' | 'morale_collapse' | 'retreat' | 'death';
  unitId: string;
  targetId?: string;
  value?: number;
  message: string;
}

/**
 * 유닛 전투 상태
 */
export interface UnitCombatState {
  unitId: string;
  currentPhase: number;
  prePhase: number;
  bonusPhase: number;
  maxPhase: number;
  hasActed: boolean;
  activatedSkills: Set<string>;
  loggedSkills: Map<string, number>;
  killed: number;
  killedCurrent: number;
  dead: number;
  deadCurrent: number;
  isFinished: boolean;
}

/**
 * 선제 공격 판정 결과
 */
export interface InitiativeResult {
  winnerId: string;
  loserId: string;
  winnerSpeed: number;
  loserSpeed: number;
  isTie: boolean;
}

/**
 * 페이즈 매니저 설정
 */
export interface PhaseManagerConfig {
  maxPhasesPerTurn: number;
  basePhaseSpeed: number;
  moraleCollapseThreshold: number;
  retreatMoraleThreshold: number;
  autoRetreatCasualtyRatio: number;
}

// ============================================================================
// 상수
// ============================================================================

export const DEFAULT_PHASE_CONFIG: PhaseManagerConfig = {
  maxPhasesPerTurn: 10,
  basePhaseSpeed: 3,
  moraleCollapseThreshold: 20,
  retreatMoraleThreshold: 30,
  autoRetreatCasualtyRatio: 0.7, // 70% 손실시 자동 퇴각
};

/**
 * 병종별 기본 속도 (페이즈 수)
 */
export const UNIT_TYPE_SPEED: Record<UnitType, number> = {
  [UnitType.FOOTMAN]: 3,
  [UnitType.CAVALRY]: 5,
  [UnitType.ARCHER]: 3,
  [UnitType.WIZARD]: 2,
  [UnitType.SIEGE]: 1,
};

// ============================================================================
// BattlePhaseManager 클래스
// ============================================================================

/**
 * 전투 페이즈 매니저
 * 전투의 각 페이즈(선제공격, 원거리, 근접, 계략, 퇴각)를 관리
 */
export class BattlePhaseManager {
  private damageCalculator: DamageCalculator;
  private config: PhaseManagerConfig;
  private unitStates: Map<string, UnitCombatState>;
  private currentPhase: CombatPhaseType;
  private phaseOrder: CombatPhaseType[];

  constructor(config: Partial<PhaseManagerConfig> = {}) {
    this.damageCalculator = new DamageCalculator();
    this.config = { ...DEFAULT_PHASE_CONFIG, ...config };
    this.unitStates = new Map();
    this.currentPhase = 'initiative';
    this.phaseOrder = ['initiative', 'ranged', 'melee', 'tactics', 'retreat', 'resolution'];
  }

  /**
   * 전투 유닛 초기화
   */
  initializeUnit(unit: BattleUnit3D): UnitCombatState {
    const maxPhase = this.calculateMaxPhase(unit);
    
    const state: UnitCombatState = {
      unitId: unit.id,
      currentPhase: 0,
      prePhase: 0,
      bonusPhase: 0,
      maxPhase,
      hasActed: false,
      activatedSkills: new Set(),
      loggedSkills: new Map(),
      killed: 0,
      killedCurrent: 0,
      dead: 0,
      deadCurrent: 0,
      isFinished: false,
    };
    
    this.unitStates.set(unit.id, state);
    return state;
  }

  /**
   * 최대 페이즈 계산 (PHP getMaxPhase 참조)
   */
  calculateMaxPhase(unit: BattleUnit3D): number {
    const baseSpeed = UNIT_TYPE_SPEED[unit.unitType] ?? this.config.basePhaseSpeed;
    
    // 특성에 따른 보너스 페이즈 (특기 시스템과 연동)
    let bonusPhase = 0;
    
    // 속도 스탯 기반 보너스
    if (unit.speed > 5) {
      bonusPhase += Math.floor((unit.speed - 5) / 2);
    }
    
    return Math.min(baseSpeed + bonusPhase, this.config.maxPhasesPerTurn);
  }

  /**
   * 선제 공격 판정 (Initiative Phase)
   * PHP의 속도 비교 로직 참조
   */
  determineInitiative(attacker: BattleUnit3D, defender: BattleUnit3D): InitiativeResult {
    // 속도 계산 (병종 기본 속도 + 개인 속도 스탯)
    const attackerSpeed = UNIT_TYPE_SPEED[attacker.unitType] + attacker.speed * 0.1;
    const defenderSpeed = UNIT_TYPE_SPEED[defender.unitType] + defender.speed * 0.1;
    
    // 동점시 랜덤 결정
    if (Math.abs(attackerSpeed - defenderSpeed) < 0.1) {
      const rand = Math.random();
      return {
        winnerId: rand > 0.5 ? attacker.id : defender.id,
        loserId: rand > 0.5 ? defender.id : attacker.id,
        winnerSpeed: Math.max(attackerSpeed, defenderSpeed),
        loserSpeed: Math.min(attackerSpeed, defenderSpeed),
        isTie: true,
      };
    }
    
    const winner = attackerSpeed > defenderSpeed ? attacker : defender;
    const loser = attackerSpeed > defenderSpeed ? defender : attacker;
    
    return {
      winnerId: winner.id,
      loserId: loser.id,
      winnerSpeed: Math.max(attackerSpeed, defenderSpeed),
      loserSpeed: Math.min(attackerSpeed, defenderSpeed),
      isTie: false,
    };
  }

  /**
   * 원거리 공격 페이즈 처리
   */
  processRangedPhase(
    rangedUnits: BattleUnit3D[],
    targets: Map<string, BattleUnit3D>,
    state: BattleState
  ): PhaseResult {
    const result: PhaseResult = {
      phase: 'ranged',
      actions: [],
      casualties: new Map(),
      moraleLosses: new Map(),
      events: [],
      nextPhase: 'melee',
      isComplete: true,
    };
    
    // 원거리 유닛만 필터링
    const eligibleUnits = rangedUnits.filter(
      u => u.unitType === UnitType.ARCHER || u.unitType === UnitType.SIEGE
    );
    
    for (const unit of eligibleUnits) {
      const target = targets.get(unit.id);
      if (!target || target.hp <= 0) continue;
      
      const unitState = this.unitStates.get(unit.id);
      if (!unitState || unitState.hasActed) continue;
      
      // 사정거리 체크
      const distance = this.calculateDistance(unit.position, target.position);
      if (distance > unit.attackRange) continue;
      
      // 데미지 계산
      const context: CombatContext = {
        attacker: unit,
        defender: target,
        terrain: this.getTerrainAt(state, target.position),
        heightDiff: unit.position.z - target.position.z,
        isAttackerTurn: true,
        phase: 'ranged',
      };
      
      const damageResult = this.damageCalculator.calculateDamage(context);
      
      // 액션 기록
      const action: PhaseAction = {
        unitId: unit.id,
        type: 'attack',
        targetId: target.id,
        damage: damageResult,
        success: !damageResult.isEvaded,
        message: damageResult.isEvaded
          ? `${unit.name}의 공격을 ${target.name}이(가) 회피!`
          : `${unit.name}이(가) ${target.name}에게 ${damageResult.finalDamage} 피해!`,
      };
      result.actions.push(action);
      
      // 피해 적용
      if (!damageResult.isEvaded) {
        const currentCasualties = result.casualties.get(target.id) ?? 0;
        result.casualties.set(target.id, currentCasualties + damageResult.finalDamage);
        
        const currentMoraleLoss = result.moraleLosses.get(target.id) ?? 0;
        result.moraleLosses.set(target.id, currentMoraleLoss + damageResult.moraleDamage);
        
        // 크리티컬 이벤트
        if (damageResult.isCritical) {
          result.events.push({
            type: 'critical',
            unitId: unit.id,
            targetId: target.id,
            value: damageResult.criticalMultiplier,
            message: `${unit.name}의 필살 공격!`,
          });
        }
      } else {
        result.events.push({
          type: 'evade',
          unitId: target.id,
          message: `${target.name}이(가) 공격을 회피!`,
        });
      }
      
      unitState.hasActed = true;
    }
    
    return result;
  }

  /**
   * 근접 공격 페이즈 처리
   */
  processMeleePhase(
    combatPairs: [BattleUnit3D, BattleUnit3D][],
    state: BattleState
  ): PhaseResult {
    const result: PhaseResult = {
      phase: 'melee',
      actions: [],
      casualties: new Map(),
      moraleLosses: new Map(),
      events: [],
      nextPhase: 'tactics',
      isComplete: true,
    };
    
    for (const [attacker, defender] of combatPairs) {
      if (attacker.hp <= 0 || defender.hp <= 0) continue;
      
      const terrain = this.getTerrainAt(state, defender.position);
      const heightDiff = attacker.position.z - defender.position.z;
      
      // 상호 데미지 계산
      const { attackerDamage, defenderDamage } = this.damageCalculator.calculateMutualDamage(
        attacker,
        defender,
        terrain,
        heightDiff
      );
      
      // 공격자 -> 방어자 데미지
      if (!attackerDamage.isEvaded) {
        const casualty = result.casualties.get(defender.id) ?? 0;
        result.casualties.set(defender.id, casualty + attackerDamage.finalDamage);
        
        result.actions.push({
          unitId: attacker.id,
          type: 'attack',
          targetId: defender.id,
          damage: attackerDamage,
          success: true,
          message: `${attacker.name} → ${defender.name}: ${attackerDamage.finalDamage} 피해`,
        });
        
        if (attackerDamage.isCritical) {
          result.events.push({
            type: 'critical',
            unitId: attacker.id,
            targetId: defender.id,
            value: attackerDamage.criticalMultiplier,
            message: `${attacker.name}의 필살!`,
          });
        }
      }
      
      // 방어자 -> 공격자 반격
      if (!defenderDamage.isEvaded) {
        const casualty = result.casualties.get(attacker.id) ?? 0;
        result.casualties.set(attacker.id, casualty + defenderDamage.finalDamage);
        
        result.actions.push({
          unitId: defender.id,
          type: 'attack',
          targetId: attacker.id,
          damage: defenderDamage,
          success: true,
          message: `${defender.name} → ${attacker.name}: ${defenderDamage.finalDamage} 반격`,
        });
      }
      
      // 사기 데미지 적용
      const attackerMoraleLoss = defenderDamage.isEvaded ? 0 : defenderDamage.moraleDamage;
      const defenderMoraleLoss = attackerDamage.isEvaded ? 0 : attackerDamage.moraleDamage;
      
      const currentAttackerMorale = result.moraleLosses.get(attacker.id) ?? 0;
      const currentDefenderMorale = result.moraleLosses.get(defender.id) ?? 0;
      
      result.moraleLosses.set(attacker.id, currentAttackerMorale + attackerMoraleLoss);
      result.moraleLosses.set(defender.id, currentDefenderMorale + defenderMoraleLoss);
    }
    
    return result;
  }

  /**
   * 계략 페이즈 처리
   * Agent D의 트리거 시스템과 연동
   */
  processTacticsPhase(
    tacticians: BattleUnit3D[],
    targets: Map<string, BattleUnit3D>,
    _state: BattleState
  ): PhaseResult {
    const result: PhaseResult = {
      phase: 'tactics',
      actions: [],
      casualties: new Map(),
      moraleLosses: new Map(),
      events: [],
      nextPhase: 'retreat',
      isComplete: true,
    };
    
    // 술사/지장 계열만 계략 사용 가능
    const eligibleUnits = tacticians.filter(
      u => u.unitType === UnitType.WIZARD || (u.intelligence >= 80)
    );
    
    for (const unit of eligibleUnits) {
      const target = targets.get(unit.id);
      if (!target) continue;
      
      // 계략 성공 확률 = 지력 차이 기반
      const successChance = 0.3 + (unit.intelligence - target.intelligence) * 0.01;
      const roll = Math.random();
      
      if (roll < successChance) {
        // 계략 성공 - 사기 감소
        const moraleDamage = Math.floor(10 + unit.intelligence * 0.2);
        
        result.actions.push({
          unitId: unit.id,
          type: 'skill',
          targetId: target.id,
          success: true,
          message: `${unit.name}의 계략이 ${target.name}에게 적중! 사기 -${moraleDamage}`,
        });
        
        const currentMorale = result.moraleLosses.get(target.id) ?? 0;
        result.moraleLosses.set(target.id, currentMorale + moraleDamage);
        
        result.events.push({
          type: 'skill_trigger',
          unitId: unit.id,
          targetId: target.id,
          value: moraleDamage,
          message: `계략 성공!`,
        });
      } else {
        result.actions.push({
          unitId: unit.id,
          type: 'skill',
          targetId: target.id,
          success: false,
          message: `${unit.name}의 계략을 ${target.name}이(가) 간파!`,
        });
      }
    }
    
    return result;
  }

  /**
   * 퇴각 판정 페이즈
   */
  processRetreatPhase(
    units: BattleUnit3D[],
    _state: BattleState
  ): PhaseResult {
    const result: PhaseResult = {
      phase: 'retreat',
      actions: [],
      casualties: new Map(),
      moraleLosses: new Map(),
      events: [],
      nextPhase: 'resolution',
      isComplete: true,
    };
    
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      
      const unitState = this.unitStates.get(unit.id);
      
      // 퇴각 조건 체크
      const shouldRetreat = this.checkRetreatCondition(unit, unitState);
      
      if (shouldRetreat) {
        result.actions.push({
          unitId: unit.id,
          type: 'retreat',
          success: true,
          message: `${unit.name}이(가) 퇴각!`,
        });
        
        result.events.push({
          type: 'retreat',
          unitId: unit.id,
          message: `${unit.name} 퇴각`,
        });
      }
      
      // 사기 붕괴 체크
      if (unit.morale <= this.config.moraleCollapseThreshold) {
        const collapseChance = (this.config.moraleCollapseThreshold - unit.morale) / 100;
        
        if (Math.random() < collapseChance) {
          result.events.push({
            type: 'morale_collapse',
            unitId: unit.id,
            message: `${unit.name}의 사기가 붕괴!`,
          });
        }
      }
    }
    
    return result;
  }

  /**
   * 퇴각 조건 체크
   */
  private checkRetreatCondition(unit: BattleUnit3D, unitState?: UnitCombatState): boolean {
    // 사기 임계값 이하
    if (unit.morale <= this.config.retreatMoraleThreshold) {
      return true;
    }
    
    // 병력 손실 임계값 초과
    const casualtyRatio = 1 - (unit.troops / unit.maxTroops);
    if (casualtyRatio >= this.config.autoRetreatCasualtyRatio) {
      return true;
    }
    
    // HP 0 이하
    if (unit.hp <= 0) {
      return true;
    }
    
    return false;
  }

  /**
   * 결과 처리 페이즈
   */
  processResolutionPhase(
    units: BattleUnit3D[],
    casualties: Map<string, number>,
    moraleLosses: Map<string, number>
  ): PhaseResult {
    const result: PhaseResult = {
      phase: 'resolution',
      actions: [],
      casualties: new Map(),
      moraleLosses: new Map(),
      events: [],
      nextPhase: null,
      isComplete: true,
    };
    
    for (const unit of units) {
      const casualty = casualties.get(unit.id) ?? 0;
      const moraleLoss = moraleLosses.get(unit.id) ?? 0;
      
      // 피해 적용
      unit.hp -= casualty;
      unit.morale = Math.max(0, unit.morale - moraleLoss);
      
      // 병력 손실 계산
      const troopLoss = Math.floor((casualty / unit.maxHp) * unit.maxTroops);
      unit.troops = Math.max(0, unit.troops - troopLoss);
      
      // 사망 처리
      if (unit.hp <= 0 || unit.troops <= 0) {
        result.events.push({
          type: 'death',
          unitId: unit.id,
          message: `${unit.name}이(가) 전멸!`,
        });
        
        unit.hp = 0;
        unit.troops = 0;
      }
      
      // 유닛 상태 업데이트
      const unitState = this.unitStates.get(unit.id);
      if (unitState) {
        unitState.dead += casualty;
        unitState.deadCurrent = casualty;
      }
    }
    
    return result;
  }

  /**
   * 전체 턴 처리
   */
  processTurn(
    attacker: BattleUnit3D,
    defender: BattleUnit3D,
    state: BattleState
  ): PhaseResult[] {
    const results: PhaseResult[] = [];
    
    // 유닛 상태 초기화
    if (!this.unitStates.has(attacker.id)) {
      this.initializeUnit(attacker);
    }
    if (!this.unitStates.has(defender.id)) {
      this.initializeUnit(defender);
    }
    
    // 선제 판정
    const initiative = this.determineInitiative(attacker, defender);
    
    // 원거리 페이즈
    const rangedTargets = new Map<string, BattleUnit3D>([
      [attacker.id, defender],
      [defender.id, attacker],
    ]);
    const rangedResult = this.processRangedPhase([attacker, defender], rangedTargets, state);
    results.push(rangedResult);
    
    // 근접 페이즈
    const meleeResult = this.processMeleePhase([[attacker, defender]], state);
    results.push(meleeResult);
    
    // 계략 페이즈
    const tacticsTargets = new Map<string, BattleUnit3D>([
      [attacker.id, defender],
      [defender.id, attacker],
    ]);
    const tacticsResult = this.processTacticsPhase([attacker, defender], tacticsTargets, state);
    results.push(tacticsResult);
    
    // 퇴각 판정
    const retreatResult = this.processRetreatPhase([attacker, defender], state);
    results.push(retreatResult);
    
    // 결과 처리 (모든 피해/사기 합산)
    const totalCasualties = new Map<string, number>();
    const totalMoraleLosses = new Map<string, number>();
    
    for (const phaseResult of results) {
      phaseResult.casualties.forEach((casualty, unitId) => {
        const current = totalCasualties.get(unitId) ?? 0;
        totalCasualties.set(unitId, current + casualty);
      });
      phaseResult.moraleLosses.forEach((morale, unitId) => {
        const current = totalMoraleLosses.get(unitId) ?? 0;
        totalMoraleLosses.set(unitId, current + morale);
      });
    }
    
    const resolutionResult = this.processResolutionPhase(
      [attacker, defender],
      totalCasualties,
      totalMoraleLosses
    );
    results.push(resolutionResult);
    
    // 페이즈 카운터 증가
    this.incrementPhase(attacker.id);
    this.incrementPhase(defender.id);
    
    return results;
  }

  /**
   * 페이즈 카운터 증가
   */
  private incrementPhase(unitId: string): void {
    const state = this.unitStates.get(unitId);
    if (state) {
      state.currentPhase++;
      state.hasActed = false;
      state.killedCurrent = 0;
      state.deadCurrent = 0;
    }
  }

  /**
   * 전투 종료 조건 체크
   */
  checkBattleEnd(attacker: BattleUnit3D, defender: BattleUnit3D): {
    isEnded: boolean;
    reason?: 'elimination' | 'retreat' | 'time' | 'surrender';
    winner?: 'attacker' | 'defender';
  } {
    // 전멸 체크
    if (attacker.hp <= 0 || attacker.troops <= 0) {
      return { isEnded: true, reason: 'elimination', winner: 'defender' };
    }
    if (defender.hp <= 0 || defender.troops <= 0) {
      return { isEnded: true, reason: 'elimination', winner: 'attacker' };
    }
    
    // 퇴각 체크
    const attackerState = this.unitStates.get(attacker.id);
    const defenderState = this.unitStates.get(defender.id);
    
    if (attackerState?.isFinished) {
      return { isEnded: true, reason: 'retreat', winner: 'defender' };
    }
    if (defenderState?.isFinished) {
      return { isEnded: true, reason: 'retreat', winner: 'attacker' };
    }
    
    // 시간 초과 체크 (최대 페이즈 도달)
    if (attackerState && attackerState.currentPhase >= attackerState.maxPhase &&
        defenderState && defenderState.currentPhase >= defenderState.maxPhase) {
      // 남은 병력으로 승자 결정
      const attackerRemaining = attacker.troops / attacker.maxTroops;
      const defenderRemaining = defender.troops / defender.maxTroops;
      
      return {
        isEnded: true,
        reason: 'time',
        winner: attackerRemaining > defenderRemaining ? 'attacker' : 'defender',
      };
    }
    
    return { isEnded: false };
  }

  /**
   * 거리 계산 헬퍼
   */
  private calculateDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number }
  ): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }

  /**
   * 지형 조회 헬퍼
   */
  private getTerrainAt(
    state: BattleState,
    position: { x: number; y: number; z: number }
  ): import('./types').TerrainType {
    const { TerrainType } = require('./types');
    
    const tile = state.map[position.y]?.[position.x];
    return tile?.type ?? TerrainType.PLAIN;
  }

  /**
   * 유닛 상태 조회
   */
  getUnitState(unitId: string): UnitCombatState | undefined {
    return this.unitStates.get(unitId);
  }

  /**
   * 현재 페이즈 조회
   */
  getCurrentPhase(): CombatPhaseType {
    return this.currentPhase;
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.unitStates.clear();
    this.currentPhase = 'initiative';
  }
}

// 싱글톤 인스턴스 export
export const battlePhaseManager = new BattlePhaseManager();

