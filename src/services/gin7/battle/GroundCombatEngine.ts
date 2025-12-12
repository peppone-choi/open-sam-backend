/**
 * GroundCombatEngine
 * 
 * 지상전 전용 틱 기반 엔진
 * - PlanetaryBattleService와 연동
 * - 유닛 타입별 상성 및 전투 로직
 * - 지형/요새화 보너스 적용
 * - 사기(Morale) 시스템
 * - 지휘관 능력치 반영
 */

import { EventEmitter } from 'events';
import { IGroundDeployment, IPlanetaryBattleState, PLANETARY_BATTLE_CONFIG } from './PlanetaryBattleService';

/**
 * 지상 유닛 타입
 */
export type GroundUnitType = 'ARMORED' | 'GRENADIER' | 'LIGHT_INFANTRY';

/**
 * 지형 타입
 */
export type TerrainType = 'PLAINS' | 'URBAN' | 'MOUNTAINOUS' | 'FOREST' | 'DESERT';

/**
 * 지상 유닛 상태
 */
export interface IGroundUnit {
  id: string;
  deploymentId: string;
  factionId: string;
  type: GroundUnitType;
  
  // 전투 스탯
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  
  // 위치
  position: { x: number; y: number };
  
  // 상태
  morale: number;          // 0-100, 50 이하면 패닉
  suppressed: boolean;     // 제압 상태
  entrenched: boolean;     // 참호/방어 태세
  
  // 지휘관 보너스
  commanderBonus: number;  // 지휘관 능력치에서 계산
}

/**
 * 지상전 상태
 */
export interface IGroundCombatState {
  planetId: string;
  sessionId: string;
  battleId: string;
  
  // 유닛
  attackerUnits: IGroundUnit[];
  defenderUnits: IGroundUnit[];
  
  // 지형
  terrain: TerrainType;
  fortificationLevel: number;  // 0-100
  
  // 전투 통계
  currentTick: number;
  roundNumber: number;
  
  // 사상자
  attackerCasualties: number;
  defenderCasualties: number;
  
  // 상태
  isActive: boolean;
  isPaused: boolean;
}

/**
 * 유닛 타입별 기본 스탯
 */
export const GROUND_UNIT_STATS: Record<GroundUnitType, {
  hp: number;
  attack: number;
  defense: number;
  mobility: number;
}> = {
  ARMORED: {
    hp: 150,
    attack: 30,
    defense: 40,
    mobility: 2
  },
  GRENADIER: {
    hp: 100,
    attack: 25,
    defense: 20,
    mobility: 3
  },
  LIGHT_INFANTRY: {
    hp: 80,
    attack: 15,
    defense: 15,
    mobility: 5
  }
};

/**
 * 유닛 상성 매트릭스 (공격자 -> 방어자 데미지 배율)
 */
export const UNIT_MATCHUP: Record<GroundUnitType, Record<GroundUnitType, number>> = {
  ARMORED: {
    ARMORED: 1.0,
    GRENADIER: 0.8,      // 척탄병에게 약간 약함 (대전차)
    LIGHT_INFANTRY: 1.5  // 경보병에게 강함
  },
  GRENADIER: {
    ARMORED: 1.3,        // 기갑에게 강함 (대전차)
    GRENADIER: 1.0,
    LIGHT_INFANTRY: 1.1
  },
  LIGHT_INFANTRY: {
    ARMORED: 0.5,        // 기갑에게 약함
    GRENADIER: 0.9,
    LIGHT_INFANTRY: 1.0
  }
};

/**
 * 지형 보너스
 */
export const TERRAIN_MODIFIERS: Record<TerrainType, {
  attackMod: number;
  defenseMod: number;
  coverBonus: number;
  description: string;
}> = {
  PLAINS: {
    attackMod: 1.0,
    defenseMod: 1.0,
    coverBonus: 0,
    description: '평지 - 기갑 유리'
  },
  URBAN: {
    attackMod: 0.8,
    defenseMod: 1.3,
    coverBonus: 20,
    description: '도시 - 방어 유리, 엄폐물'
  },
  MOUNTAINOUS: {
    attackMod: 0.7,
    defenseMod: 1.5,
    coverBonus: 30,
    description: '산악 - 방어 매우 유리'
  },
  FOREST: {
    attackMod: 0.9,
    defenseMod: 1.2,
    coverBonus: 15,
    description: '삼림 - 경보병 유리'
  },
  DESERT: {
    attackMod: 1.1,
    defenseMod: 0.9,
    coverBonus: 5,
    description: '사막 - 공격 유리'
  }
};

/**
 * 지상전 설정
 */
export const GROUND_COMBAT_CONFIG = {
  // 틱 설정
  tickInterval: 100,               // ms per tick
  ticksPerRound: 10,               // 라운드당 틱
  
  // 사기
  baseMorale: 80,
  moraleLossPerCasualty: 2,        // 사상자당 사기 감소
  panicThreshold: 30,              // 패닉 임계점
  routThreshold: 15,               // 와해 임계점
  moraleRecoveryPerTick: 0.5,      // 틱당 사기 회복
  
  // 제압
  suppressionChance: 0.15,         // 틱당 제압 확률
  suppressionDuration: 30,         // 제압 지속 틱
  
  // 참호
  entrenchmentBonus: 1.5,          // 참호 방어 보너스
  entrenchmentTicksRequired: 50,   // 참호 구축 시간
  
  // 지휘관
  commanderAttackBonus: 0.02,      // 지휘관 공격력당 보너스
  commanderDefenseBonus: 0.02,     // 지휘관 방어력당 보너스
  commanderMoraleBonus: 0.5,       // 지휘관 통솔당 사기 보너스
  
  // 요새화
  fortificationDefenseMultiplier: 0.5,  // 요새화 100당 방어 보너스
  
  // 승리 조건
  victoryMoraleThreshold: 10,      // 전체 사기가 이 이하면 패배
  victoryUnitThreshold: 0.1,       // 유닛이 10% 이하면 패배
};

/**
 * GroundCombatEngine 클래스
 */
class GroundCombatEngine extends EventEmitter {
  private combatStates: Map<string, IGroundCombatState> = new Map();  // planetId -> state
  private tickTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  /**
   * 지상전 초기화
   */
  initializeCombat(
    planetId: string,
    sessionId: string,
    battleId: string,
    attackerDeployments: IGroundDeployment[],
    defenderUnits: number,
    terrain: TerrainType,
    fortificationLevel: number,
    commanderStats?: { attack: number; defense: number; leadership: number }
  ): IGroundCombatState {
    // 공격측 유닛 생성
    const attackerUnits: IGroundUnit[] = [];
    let unitId = 0;
    
    for (const deployment of attackerDeployments) {
      for (const unitType of deployment.unitTypes) {
        for (let i = 0; i < unitType.count; i++) {
          const stats = GROUND_UNIT_STATS[unitType.type];
          attackerUnits.push({
            id: `atk_${unitId++}`,
            deploymentId: deployment.id,
            factionId: deployment.factionId,
            type: unitType.type,
            hp: stats.hp,
            maxHp: stats.hp,
            attack: stats.attack,
            defense: stats.defense,
            position: { x: Math.random() * 100, y: Math.random() * 50 },
            morale: GROUND_COMBAT_CONFIG.baseMorale,
            suppressed: false,
            entrenched: false,
            commanderBonus: commanderStats 
              ? (commanderStats.attack * GROUND_COMBAT_CONFIG.commanderAttackBonus) 
              : 0
          });
        }
      }
    }

    // 방어측 유닛 생성 (기본 경보병으로)
    const defenderUnitList: IGroundUnit[] = [];
    for (let i = 0; i < defenderUnits; i++) {
      const stats = GROUND_UNIT_STATS.LIGHT_INFANTRY;
      defenderUnitList.push({
        id: `def_${i}`,
        deploymentId: 'garrison',
        factionId: 'defender',
        type: 'LIGHT_INFANTRY',
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        position: { x: 50 + Math.random() * 50, y: 50 + Math.random() * 50 },
        morale: GROUND_COMBAT_CONFIG.baseMorale + 10,  // 방어측 사기 보너스
        suppressed: false,
        entrenched: true,  // 방어측은 시작부터 참호
        commanderBonus: 0
      });
    }

    const state: IGroundCombatState = {
      planetId,
      sessionId,
      battleId,
      attackerUnits,
      defenderUnits: defenderUnitList,
      terrain,
      fortificationLevel,
      currentTick: 0,
      roundNumber: 0,
      attackerCasualties: 0,
      defenderCasualties: 0,
      isActive: true,
      isPaused: false
    };

    this.combatStates.set(planetId, state);

    this.emit('ground_combat:initialized', { planetId, attackerCount: attackerUnits.length, defenderCount: defenderUnitList.length });

    return state;
  }

  /**
   * 전투 시작
   */
  startCombat(planetId: string): boolean {
    const state = this.combatStates.get(planetId);
    if (!state || !state.isActive) return false;

    const timer = setInterval(() => {
      this.processTick(planetId);
    }, GROUND_COMBAT_CONFIG.tickInterval);

    this.tickTimers.set(planetId, timer);

    this.emit('ground_combat:started', { planetId });

    return true;
  }

  /**
   * 전투 일시정지
   */
  pauseCombat(planetId: string): boolean {
    const state = this.combatStates.get(planetId);
    if (!state) return false;

    state.isPaused = true;
    
    const timer = this.tickTimers.get(planetId);
    if (timer) {
      clearInterval(timer);
      this.tickTimers.delete(planetId);
    }

    this.emit('ground_combat:paused', { planetId });

    return true;
  }

  /**
   * 전투 재개
   */
  resumeCombat(planetId: string): boolean {
    const state = this.combatStates.get(planetId);
    if (!state || !state.isPaused) return false;

    state.isPaused = false;
    return this.startCombat(planetId);
  }

  /**
   * 틱 처리
   */
  private processTick(planetId: string): void {
    const state = this.combatStates.get(planetId);
    if (!state || !state.isActive || state.isPaused) return;

    state.currentTick++;

    // 라운드 체크
    if (state.currentTick % GROUND_COMBAT_CONFIG.ticksPerRound === 0) {
      state.roundNumber++;
      this.processRound(state);
    }

    // 사기 회복
    this.processMoraleRecovery(state);

    // 제압 해제 체크
    this.processSuppressionRecovery(state);

    // 승리 조건 체크
    const result = this.checkVictoryCondition(state);
    if (result.isResolved) {
      this.endCombat(planetId, result.victor!);
    }

    // 틱 이벤트 발송 (매 10틱마다)
    if (state.currentTick % 10 === 0) {
      this.emit('ground_combat:tick', {
        planetId,
        tick: state.currentTick,
        round: state.roundNumber,
        attackerRemaining: state.attackerUnits.filter(u => u.hp > 0).length,
        defenderRemaining: state.defenderUnits.filter(u => u.hp > 0).length
      });
    }
  }

  /**
   * 라운드 처리 (전투 해결)
   */
  private processRound(state: IGroundCombatState): void {
    const attackers = state.attackerUnits.filter(u => u.hp > 0 && !u.suppressed);
    const defenders = state.defenderUnits.filter(u => u.hp > 0 && !u.suppressed);

    if (attackers.length === 0 || defenders.length === 0) return;

    // 지형 보너스
    const terrainMod = TERRAIN_MODIFIERS[state.terrain];
    const fortificationBonus = 1 + (state.fortificationLevel / 100) * GROUND_COMBAT_CONFIG.fortificationDefenseMultiplier;

    // 공격측 공격
    let attackerTotalDamage = 0;
    for (const attacker of attackers) {
      const target = this.selectTarget(attacker, defenders);
      if (!target) continue;

      const damage = this.calculateDamage(attacker, target, terrainMod, false, 1);
      attackerTotalDamage += damage;
      
      target.hp -= damage;
      
      // 제압 체크
      if (Math.random() < GROUND_COMBAT_CONFIG.suppressionChance) {
        target.suppressed = true;
      }

      // 사기 감소
      if (damage > 0) {
        target.morale -= GROUND_COMBAT_CONFIG.moraleLossPerCasualty * (damage / target.maxHp);
      }

      if (target.hp <= 0) {
        state.defenderCasualties++;
        this.emit('ground_combat:unit_destroyed', { planetId: state.planetId, unit: target, side: 'defender' });
      }
    }

    // 방어측 반격
    const survivingDefenders = defenders.filter(u => u.hp > 0 && !u.suppressed);
    let defenderTotalDamage = 0;
    
    for (const defender of survivingDefenders) {
      const target = this.selectTarget(defender, attackers);
      if (!target) continue;

      const entrenchBonus = defender.entrenched ? GROUND_COMBAT_CONFIG.entrenchmentBonus : 1;
      const damage = this.calculateDamage(defender, target, terrainMod, true, fortificationBonus * entrenchBonus);
      defenderTotalDamage += damage;
      
      target.hp -= damage;

      // 제압 체크
      if (Math.random() < GROUND_COMBAT_CONFIG.suppressionChance * 0.8) {  // 공격측은 제압 확률 낮음
        target.suppressed = true;
      }

      // 사기 감소
      if (damage > 0) {
        target.morale -= GROUND_COMBAT_CONFIG.moraleLossPerCasualty * (damage / target.maxHp);
      }

      if (target.hp <= 0) {
        state.attackerCasualties++;
        this.emit('ground_combat:unit_destroyed', { planetId: state.planetId, unit: target, side: 'attacker' });
      }
    }

    this.emit('ground_combat:round', {
      planetId: state.planetId,
      round: state.roundNumber,
      attackerDamage: attackerTotalDamage,
      defenderDamage: defenderTotalDamage,
      attackerCasualties: state.attackerCasualties,
      defenderCasualties: state.defenderCasualties
    });
  }

  /**
   * 타겟 선택
   */
  private selectTarget(attacker: IGroundUnit, enemies: IGroundUnit[]): IGroundUnit | null {
    const alive = enemies.filter(u => u.hp > 0);
    if (alive.length === 0) return null;

    // 거리 기반 + 상성 유리한 타겟 우선
    const scored = alive.map(enemy => {
      const distance = Math.sqrt(
        Math.pow(attacker.position.x - enemy.position.x, 2) +
        Math.pow(attacker.position.y - enemy.position.y, 2)
      );
      const matchupBonus = UNIT_MATCHUP[attacker.type][enemy.type];
      const hpPriority = (100 - enemy.hp) / 100;  // 낮은 HP 우선
      
      return {
        unit: enemy,
        score: matchupBonus * 10 + hpPriority * 5 - distance * 0.1
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.unit || null;
  }

  /**
   * 데미지 계산
   */
  private calculateDamage(
    attacker: IGroundUnit,
    defender: IGroundUnit,
    terrainMod: typeof TERRAIN_MODIFIERS[TerrainType],
    isDefending: boolean,
    defenseBonusMultiplier: number
  ): number {
    // 기본 공격력
    let damage = attacker.attack;

    // 상성 보너스
    damage *= UNIT_MATCHUP[attacker.type][defender.type];

    // 지휘관 보너스
    damage *= (1 + attacker.commanderBonus);

    // 지형 보너스
    if (isDefending) {
      damage *= terrainMod.defenseMod;
    } else {
      damage *= terrainMod.attackMod;
    }

    // 방어력 적용
    let defense = defender.defense;
    if (isDefending) {
      defense *= defenseBonusMultiplier;
    }
    defense += terrainMod.coverBonus;

    // 최종 데미지
    damage = Math.max(1, damage - defense * 0.5);

    // 사기 영향
    if (attacker.morale < GROUND_COMBAT_CONFIG.panicThreshold) {
      damage *= 0.5;  // 패닉 상태면 데미지 절반
    }

    // 약간의 랜덤
    damage *= (0.8 + Math.random() * 0.4);

    return Math.floor(damage);
  }

  /**
   * 사기 회복 처리
   */
  private processMoraleRecovery(state: IGroundCombatState): void {
    const allUnits = [...state.attackerUnits, ...state.defenderUnits];
    
    for (const unit of allUnits) {
      if (unit.hp <= 0) continue;
      
      if (unit.morale < GROUND_COMBAT_CONFIG.baseMorale) {
        unit.morale += GROUND_COMBAT_CONFIG.moraleRecoveryPerTick;
        unit.morale = Math.min(unit.morale, GROUND_COMBAT_CONFIG.baseMorale);
      }
    }
  }

  /**
   * 제압 해제 처리
   */
  private processSuppressionRecovery(state: IGroundCombatState): void {
    const allUnits = [...state.attackerUnits, ...state.defenderUnits];
    
    for (const unit of allUnits) {
      if (unit.suppressed && Math.random() < 0.05) {  // 틱당 5% 확률로 해제
        unit.suppressed = false;
      }
    }
  }

  /**
   * 승리 조건 체크
   */
  private checkVictoryCondition(state: IGroundCombatState): { isResolved: boolean; victor?: string } {
    const attackersAlive = state.attackerUnits.filter(u => u.hp > 0);
    const defendersAlive = state.defenderUnits.filter(u => u.hp > 0);

    // 유닛 전멸 체크
    if (attackersAlive.length === 0) {
      return { isResolved: true, victor: 'defender' };
    }
    if (defendersAlive.length === 0) {
      return { isResolved: true, victor: 'attacker' };
    }

    // 유닛 임계점 체크
    const attackerRatio = attackersAlive.length / state.attackerUnits.length;
    const defenderRatio = defendersAlive.length / state.defenderUnits.length;

    if (attackerRatio <= GROUND_COMBAT_CONFIG.victoryUnitThreshold) {
      return { isResolved: true, victor: 'defender' };
    }
    if (defenderRatio <= GROUND_COMBAT_CONFIG.victoryUnitThreshold) {
      return { isResolved: true, victor: 'attacker' };
    }

    // 사기 체크
    const avgAttackerMorale = attackersAlive.reduce((sum, u) => sum + u.morale, 0) / attackersAlive.length;
    const avgDefenderMorale = defendersAlive.reduce((sum, u) => sum + u.morale, 0) / defendersAlive.length;

    if (avgAttackerMorale <= GROUND_COMBAT_CONFIG.victoryMoraleThreshold) {
      return { isResolved: true, victor: 'defender' };
    }
    if (avgDefenderMorale <= GROUND_COMBAT_CONFIG.victoryMoraleThreshold) {
      return { isResolved: true, victor: 'attacker' };
    }

    return { isResolved: false };
  }

  /**
   * 전투 종료
   */
  private endCombat(planetId: string, victor: string): void {
    const state = this.combatStates.get(planetId);
    if (!state) return;

    state.isActive = false;

    // 타이머 정리
    const timer = this.tickTimers.get(planetId);
    if (timer) {
      clearInterval(timer);
      this.tickTimers.delete(planetId);
    }

    const attackersAlive = state.attackerUnits.filter(u => u.hp > 0);
    const defendersAlive = state.defenderUnits.filter(u => u.hp > 0);

    this.emit('ground_combat:ended', {
      planetId,
      victor,
      rounds: state.roundNumber,
      ticks: state.currentTick,
      attackerCasualties: state.attackerCasualties,
      defenderCasualties: state.defenderCasualties,
      attackerSurvivors: attackersAlive.length,
      defenderSurvivors: defendersAlive.length
    });
  }

  /**
   * 전투 강제 종료
   */
  forceEndCombat(planetId: string, reason: string): void {
    const state = this.combatStates.get(planetId);
    if (!state) return;

    state.isActive = false;

    const timer = this.tickTimers.get(planetId);
    if (timer) {
      clearInterval(timer);
      this.tickTimers.delete(planetId);
    }

    this.emit('ground_combat:force_ended', { planetId, reason });
  }

  /**
   * 증원 추가
   */
  addReinforcements(
    planetId: string,
    side: 'attacker' | 'defender',
    units: Array<{ type: GroundUnitType; count: number }>,
    deploymentId: string,
    factionId: string
  ): boolean {
    const state = this.combatStates.get(planetId);
    if (!state || !state.isActive) return false;

    const existingCount = side === 'attacker' 
      ? state.attackerUnits.length 
      : state.defenderUnits.length;
    
    let unitId = existingCount;

    for (const unitType of units) {
      for (let i = 0; i < unitType.count; i++) {
        const stats = GROUND_UNIT_STATS[unitType.type];
        const unit: IGroundUnit = {
          id: `${side === 'attacker' ? 'atk' : 'def'}_reinf_${unitId++}`,
          deploymentId,
          factionId,
          type: unitType.type,
          hp: stats.hp,
          maxHp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          position: side === 'attacker' 
            ? { x: Math.random() * 30, y: Math.random() * 100 }
            : { x: 70 + Math.random() * 30, y: Math.random() * 100 },
          morale: GROUND_COMBAT_CONFIG.baseMorale,
          suppressed: false,
          entrenched: false,
          commanderBonus: 0
        };

        if (side === 'attacker') {
          state.attackerUnits.push(unit);
        } else {
          state.defenderUnits.push(unit);
        }
      }
    }

    this.emit('ground_combat:reinforcements', {
      planetId,
      side,
      count: units.reduce((sum, u) => sum + u.count, 0)
    });

    return true;
  }

  /**
   * 유닛 참호 구축 명령
   */
  orderEntrench(planetId: string, unitIds: string[]): number {
    const state = this.combatStates.get(planetId);
    if (!state) return 0;

    let count = 0;
    const allUnits = [...state.attackerUnits, ...state.defenderUnits];

    for (const unitId of unitIds) {
      const unit = allUnits.find(u => u.id === unitId);
      if (unit && unit.hp > 0 && !unit.entrenched) {
        // 참호 구축 시작 (실제로는 타이머 필요)
        unit.entrenched = true;
        count++;
      }
    }

    return count;
  }

  /**
   * 전투 상태 조회
   */
  getCombatState(planetId: string): IGroundCombatState | undefined {
    return this.combatStates.get(planetId);
  }

  /**
   * 전투 통계 조회
   */
  getCombatStats(planetId: string): {
    attackerStrength: number;
    defenderStrength: number;
    attackerMorale: number;
    defenderMorale: number;
    round: number;
  } | null {
    const state = this.combatStates.get(planetId);
    if (!state) return null;

    const attackersAlive = state.attackerUnits.filter(u => u.hp > 0);
    const defendersAlive = state.defenderUnits.filter(u => u.hp > 0);

    return {
      attackerStrength: attackersAlive.length,
      defenderStrength: defendersAlive.length,
      attackerMorale: attackersAlive.length > 0 
        ? attackersAlive.reduce((sum, u) => sum + u.morale, 0) / attackersAlive.length 
        : 0,
      defenderMorale: defendersAlive.length > 0 
        ? defendersAlive.reduce((sum, u) => sum + u.morale, 0) / defendersAlive.length 
        : 0,
      round: state.roundNumber
    };
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    Array.from(this.tickTimers.values()).forEach(timer => {
      clearInterval(timer);
    });
    this.tickTimers.clear();
    this.combatStates.clear();
    this.removeAllListeners();
  }
}

// Singleton export
export const groundCombatEngine = new GroundCombatEngine();
export default GroundCombatEngine;
