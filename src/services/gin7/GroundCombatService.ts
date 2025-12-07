/**
 * GroundCombatService - 지상전(행성 점령전) 관리 서비스
 * 
 * 틱 기반 전투, 강하/철수, 점령 게이지, 궤도 폭격 등을 처리합니다.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  GroundBattle,
  IGroundBattle,
  IGroundUnit,
  IDropQueueItem,
  GroundUnitType,
  GroundBattleStatus,
  GroundBattleResult,
  GROUND_UNIT_SPECS,
  COUNTER_MATRIX,
  TERRAIN_MODIFIERS,
} from '../../models/gin7/GroundBattle';
import { Planet, IPlanet, PlanetType } from '../../models/gin7/Planet';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

// ============================================================
// Constants
// ============================================================

const GROUND_COMBAT_CONSTANTS = {
  TICK_INTERVAL_MS: 10000,        // 10초/틱
  MAX_UNITS_PER_SIDE: 30,         // 최대 유닛 수
  MAX_TROOPS_PER_UNIT: 1000,      // 유닛당 최대 병력
  
  DROP_TIME_BASE: 2,              // 기본 강하 시간 (틱)
  WITHDRAW_PENALTY: 0.3,          // 전투 중 철수 시 손실률
  WITHDRAW_TIME: 3,               // 철수 소요 시간 (틱)
  
  MORALE_DAMAGE_LOSS: 5,          // 피해 시 사기 감소
  MORALE_KILL_BONUS: 3,           // 적 처치 시 사기 증가
  MORALE_ALLY_DEATH_LOSS: 8,      // 아군 전멸 시 사기 감소
  MORALE_CHAOS_THRESHOLD: 20,     // 혼란 상태 진입 임계값
  MORALE_RECOVERY_RATE: 2,        // 턴당 사기 회복
  
  CONQUEST_BASE_RATE: 0.5,        // 기본 점령 속도
  CONQUEST_INFANTRY_BONUS: 0.1,   // 보병 1명당 추가 점령력
  
  ORBITAL_STRIKE_DAMAGE: 500,     // 궤도 폭격 기본 데미지
  ORBITAL_STRIKE_COOLDOWN: 10,    // 궤도 폭격 쿨다운 (틱)
  
  BATTLE_TIMEOUT_TICKS: 360,      // 1시간 타임아웃 (10초 * 360)
};

// ============================================================
// Event Types
// ============================================================

export interface GroundBattleStartEvent {
  battleId: string;
  sessionId: string;
  planetId: string;
  attackerFactionId: string;
  defenderFactionId?: string;
}

export interface GroundBattleEndEvent {
  battleId: string;
  sessionId: string;
  planetId: string;
  result: GroundBattleResult;
  winnerId: string | null;
  casualties: {
    attacker: number;
    defender: number;
  };
}

export interface PlanetConqueredEvent {
  sessionId: string;
  planetId: string;
  previousOwnerId?: string;
  newOwnerId: string;
  battleId: string;
}

export interface UnitDroppedEvent {
  battleId: string;
  unitId: string;
  type: GroundUnitType;
  count: number;
  factionId: string;
}

// ============================================================
// GroundCombatService Class
// ============================================================

export class GroundCombatService extends EventEmitter {
  private activeLoops: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    logger.info('[GroundCombatService] Initialized');
  }
  
  // ============================================================
  // Battle Lifecycle
  // ============================================================
  
  /**
   * 지상전 시작 (공격측이 강하 시작할 때 호출)
   */
  async startBattle(params: {
    sessionId: string;
    planetId: string;
    attackerFactionId: string;
    attackerFleetId: string;
  }): Promise<IGroundBattle> {
    const { sessionId, planetId, attackerFactionId, attackerFleetId } = params;
    
    // 행성 존재 확인
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      throw new Error(`Planet not found: ${planetId}`);
    }
    
    // 기존 전투 확인
    const existingBattle = await GroundBattle.findOne({
      sessionId,
      planetId,
      status: { $ne: 'ENDED' }
    });
    if (existingBattle) {
      throw new Error(`Active battle already exists on planet: ${planetId}`);
    }
    
    // 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId: attackerFleetId });
    if (!fleet) {
      throw new Error(`Fleet not found: ${attackerFleetId}`);
    }
    if (fleet.factionId !== attackerFactionId) {
      throw new Error('Fleet does not belong to attacking faction');
    }
    
    // 지형 보정 계산
    const terrainMod = TERRAIN_MODIFIERS[planet.type] || TERRAIN_MODIFIERS.terran;
    
    // 전투 인스턴스 생성
    const battleId = `GRD-${uuidv4().slice(0, 8)}`;
    const battle = new GroundBattle({
      battleId,
      sessionId,
      planetId,
      systemId: planet.systemId,
      
      status: 'WAITING',
      attackerFactionId,
      defenderFactionId: planet.ownerId,
      
      attackerUnits: [],
      defenderUnits: [],
      attackerDropQueue: [],
      defenderDropQueue: [],
      
      conquestGauge: 0,
      conquestRate: 0,
      
      maxUnitsPerSide: GROUND_COMBAT_CONSTANTS.MAX_UNITS_PER_SIDE,
      tickInterval: GROUND_COMBAT_CONSTANTS.TICK_INTERVAL_MS,
      currentTick: 0,
      
      terrainModifier: terrainMod,
      
      orbitalStrike: {
        available: true, // 궤도 장악 후 가능
        cooldownTicks: GROUND_COMBAT_CONSTANTS.ORBITAL_STRIKE_COOLDOWN,
        friendlyFireRisk: 15
      }
    });
    
    // 방어군 자동 배치 (행성 수비대)
    if (planet.garrisonIds && planet.garrisonIds.length > 0) {
      await this.deployGarrison(battle, planet);
    }
    
    await battle.save();
    
    logger.info('[GroundCombatService] Battle started', {
      battleId,
      planetId,
      attackerFactionId,
      defenderFactionId: planet.ownerId
    });
    
    this.emit('GROUND_BATTLE_START', {
      battleId,
      sessionId,
      planetId,
      attackerFactionId,
      defenderFactionId: planet.ownerId
    } as GroundBattleStartEvent);
    
    return battle;
  }
  
  /**
   * 행성 수비대 배치
   */
  private async deployGarrison(battle: IGroundBattle, planet: IPlanet): Promise<void> {
    // 간단한 수비대 생성 (실제로는 garrison 시스템과 연동)
    const garrisonStrength = planet.defenseRating || 10;
    const unitCount = Math.min(Math.floor(garrisonStrength / 10), 5);
    
    for (let i = 0; i < unitCount; i++) {
      const unitType: GroundUnitType = i % 3 === 0 ? 'armored' : i % 3 === 1 ? 'grenadier' : 'infantry';
      const spec = GROUND_UNIT_SPECS[unitType];
      
      const unit: IGroundUnit = {
        unitId: `DEF-${uuidv4().slice(0, 8)}`,
        type: unitType,
        count: Math.min(100 * (garrisonStrength / 10), GROUND_COMBAT_CONSTANTS.MAX_TROOPS_PER_UNIT),
        stats: {
          hp: spec.baseHp,
          maxHp: spec.baseHp,
          attack: spec.baseAttack,
          defense: spec.baseDefense,
          morale: 80, // 수비대 기본 사기
          conquestPower: spec.conquestPower
        },
        sourceFleetId: 'GARRISON',
        factionId: planet.ownerId || '',
        isDestroyed: false,
        isChaos: false,
        isRetreating: false,
        kills: 0,
        damageDealt: 0,
        damageTaken: 0,
        deployedAt: new Date()
      };
      
      battle.defenderUnits.push(unit);
    }
  }
  
  /**
   * 전투 루프 시작
   */
  startBattleLoop(battleId: string): void {
    if (this.activeLoops.has(battleId)) {
      return;
    }
    
    const loop = setInterval(async () => {
      try {
        await this.processTick(battleId);
      } catch (error) {
        logger.error('[GroundCombatService] Tick processing error', { battleId, error });
      }
    }, GROUND_COMBAT_CONSTANTS.TICK_INTERVAL_MS);
    
    this.activeLoops.set(battleId, loop);
    logger.info('[GroundCombatService] Battle loop started', { battleId });
  }
  
  /**
   * 전투 루프 중지
   */
  stopBattleLoop(battleId: string): void {
    const loop = this.activeLoops.get(battleId);
    if (loop) {
      clearInterval(loop);
      this.activeLoops.delete(battleId);
      logger.info('[GroundCombatService] Battle loop stopped', { battleId });
    }
  }
  
  // ============================================================
  // Tick Processing
  // ============================================================
  
  /**
   * 틱 처리 (매 10초)
   */
  async processTick(battleId: string): Promise<void> {
    const battle = await GroundBattle.findOne({ battleId });
    if (!battle || battle.status === 'ENDED') {
      this.stopBattleLoop(battleId);
      return;
    }
    
    battle.currentTick++;
    
    // 1. 강하 대기열 처리
    await this.processDropQueue(battle);
    
    // 2. 상태 업데이트
    this.updateBattleStatus(battle);
    
    // 3. 전투 처리 (COMBAT 상태일 때만)
    if (battle.status === 'COMBAT') {
      this.processCombat(battle);
    }
    
    // 4. 점령 게이지 처리 (CONQUERING 상태일 때)
    if (battle.status === 'CONQUERING') {
      await this.processConquest(battle);
    }
    
    // 5. 철수 처리
    this.processRetreats(battle);
    
    // 6. 사기 회복
    this.recoverMorale(battle);
    
    // 7. 승리 조건 확인
    await this.checkVictoryConditions(battle);
    
    // 8. 타임아웃 확인
    if (battle.currentTick >= GROUND_COMBAT_CONSTANTS.BATTLE_TIMEOUT_TICKS) {
      await this.endBattle(battle, 'DRAW');
    }
    
    await battle.save();
  }
  
  /**
   * 강하 대기열 처리
   */
  private async processDropQueue(battle: IGroundBattle): Promise<void> {
    const now = new Date();
    
    // 공격측 강하
    const readyAttackers = battle.attackerDropQueue.filter(
      item => item.expectedDropAt <= now
    );
    for (const item of readyAttackers) {
      if (battle.attackerUnits.filter(u => !u.isDestroyed).length < battle.maxUnitsPerSide) {
        const unit = this.createUnitFromDropItem(item);
        battle.attackerUnits.push(unit);
        
        battle.addCombatLog({
          action: 'ATTACK',
          description: `[강하 완료] ${GROUND_UNIT_SPECS[item.unitType].nameKo} ${item.count}명 전장 투입`
        });
        
        this.emit('UNIT_DROPPED', {
          battleId: battle.battleId,
          unitId: unit.unitId,
          type: unit.type,
          count: unit.count,
          factionId: unit.factionId
        } as UnitDroppedEvent);
      }
    }
    battle.attackerDropQueue = battle.attackerDropQueue.filter(
      item => item.expectedDropAt > now
    );
    
    // 방어측 증원
    const readyDefenders = battle.defenderDropQueue.filter(
      item => item.expectedDropAt <= now
    );
    for (const item of readyDefenders) {
      if (battle.defenderUnits.filter(u => !u.isDestroyed).length < battle.maxUnitsPerSide) {
        const unit = this.createUnitFromDropItem(item);
        battle.defenderUnits.push(unit);
        
        battle.addCombatLog({
          action: 'ATTACK',
          description: `[증원 도착] ${GROUND_UNIT_SPECS[item.unitType].nameKo} ${item.count}명 방어선 합류`
        });
      }
    }
    battle.defenderDropQueue = battle.defenderDropQueue.filter(
      item => item.expectedDropAt > now
    );
  }
  
  /**
   * 강하 아이템에서 유닛 생성
   */
  private createUnitFromDropItem(item: IDropQueueItem): IGroundUnit {
    const spec = GROUND_UNIT_SPECS[item.unitType];
    return {
      unitId: item.unitId,
      type: item.unitType,
      count: item.count,
      stats: {
        hp: spec.baseHp,
        maxHp: spec.baseHp,
        attack: spec.baseAttack,
        defense: spec.baseDefense,
        morale: 100,
        conquestPower: spec.conquestPower
      },
      sourceFleetId: item.fleetId,
      factionId: item.factionId,
      isDestroyed: false,
      isChaos: false,
      isRetreating: false,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      deployedAt: new Date()
    };
  }
  
  /**
   * 전투 상태 업데이트
   */
  private updateBattleStatus(battle: IGroundBattle): void {
    const aliveAttackers = battle.attackerUnits.filter(u => !u.isDestroyed);
    const aliveDefenders = battle.defenderUnits.filter(u => !u.isDestroyed);
    
    if (battle.status === 'WAITING') {
      // 공격 유닛이 있으면 전투 시작
      if (aliveAttackers.length > 0) {
        if (aliveDefenders.length > 0) {
          battle.status = 'COMBAT';
          battle.startedAt = new Date();
        } else {
          battle.status = 'CONQUERING';
          battle.startedAt = new Date();
        }
      }
    } else if (battle.status === 'DROPPING') {
      // 강하 완료 확인
      if (battle.attackerDropQueue.length === 0 && aliveAttackers.length > 0) {
        battle.status = aliveDefenders.length > 0 ? 'COMBAT' : 'CONQUERING';
      }
    } else if (battle.status === 'COMBAT') {
      // 방어군 전멸 확인
      if (aliveDefenders.length === 0) {
        battle.status = 'CONQUERING';
      }
    }
  }
  
  /**
   * 전투 처리
   */
  private processCombat(battle: IGroundBattle): void {
    const attackers = battle.attackerUnits.filter(u => !u.isDestroyed && !u.isChaos && !u.isRetreating);
    const defenders = battle.defenderUnits.filter(u => !u.isDestroyed && !u.isChaos && !u.isRetreating);
    
    if (attackers.length === 0 || defenders.length === 0) {
      return;
    }
    
    // 각 공격 유닛이 방어 유닛 공격
    for (const attacker of attackers) {
      // 랜덤 타겟 선택 (실제로는 AI 로직으로 개선 가능)
      const target = defenders[Math.floor(Math.random() * defenders.length)];
      if (target && !target.isDestroyed) {
        this.processAttack(battle, attacker, target, 'attacker');
      }
    }
    
    // 각 방어 유닛이 공격 유닛 공격
    for (const defender of defenders.filter(u => !u.isDestroyed)) {
      const target = attackers[Math.floor(Math.random() * attackers.length)];
      if (target && !target.isDestroyed) {
        this.processAttack(battle, defender, target, 'defender');
      }
    }
  }
  
  /**
   * 공격 처리
   */
  private processAttack(
    battle: IGroundBattle,
    attacker: IGroundUnit,
    target: IGroundUnit,
    attackerSide: 'attacker' | 'defender'
  ): void {
    // 상성 보정
    const counterMod = COUNTER_MATRIX[attacker.type][target.type];
    
    // 지형 보정
    const terrainMod = attackerSide === 'attacker' 
      ? battle.terrainModifier.attackerBonus 
      : battle.terrainModifier.defenderBonus;
    
    // 기본 데미지 계산
    // (공격력 * 유닛 수 * 상성 배수) - (방어력 * 0.5) + 지형 보정
    const baseDamage = (attacker.stats.attack * attacker.count * counterMod * 0.1);
    const defense = target.stats.defense * 0.5;
    const terrainBonus = terrainMod * 0.1;
    
    let finalDamage = Math.max(1, Math.floor(baseDamage - defense + terrainBonus));
    
    // 사기에 따른 데미지 보정 (사기가 낮으면 데미지 감소)
    finalDamage = Math.floor(finalDamage * (0.5 + attacker.stats.morale / 200));
    
    // 데미지 적용
    target.stats.hp -= finalDamage;
    target.damageTaken += finalDamage;
    attacker.damageDealt += finalDamage;
    
    // 사기 감소
    target.stats.morale = Math.max(0, target.stats.morale - GROUND_COMBAT_CONSTANTS.MORALE_DAMAGE_LOSS);
    
    // 병력 손실 계산 (HP가 0 이하면 유닛 비례 손실)
    if (target.stats.hp <= 0) {
      const casualtyRate = Math.min(1, Math.abs(target.stats.hp) / target.stats.maxHp + 0.2);
      const casualties = Math.ceil(target.count * casualtyRate);
      target.count = Math.max(0, target.count - casualties);
      target.stats.hp = target.stats.maxHp; // HP 리셋
      
      if (target.count <= 0) {
        target.isDestroyed = true;
        attacker.kills += 1;
        
        // 아군 사망 사기 감소
        const alliedUnits = attackerSide === 'attacker' 
          ? battle.defenderUnits 
          : battle.attackerUnits;
        for (const ally of alliedUnits) {
          if (!ally.isDestroyed) {
            ally.stats.morale = Math.max(0, ally.stats.morale - GROUND_COMBAT_CONSTANTS.MORALE_ALLY_DEATH_LOSS);
            if (ally.stats.morale <= GROUND_COMBAT_CONSTANTS.MORALE_CHAOS_THRESHOLD) {
              ally.isChaos = true;
            }
          }
        }
        
        battle.addCombatLog({
          action: 'KILL',
          sourceUnitId: attacker.unitId,
          targetUnitId: target.unitId,
          description: `[전멸] ${GROUND_UNIT_SPECS[target.type].nameKo} 부대 괴멸`
        });
      } else {
        battle.addCombatLog({
          action: 'DAMAGE',
          sourceUnitId: attacker.unitId,
          targetUnitId: target.unitId,
          damage: casualties,
          description: `${GROUND_UNIT_SPECS[attacker.type].nameKo} → ${GROUND_UNIT_SPECS[target.type].nameKo}: ${casualties}명 손실`
        });
      }
    }
    
    // 사기 붕괴 체크
    if (target.stats.morale <= GROUND_COMBAT_CONSTANTS.MORALE_CHAOS_THRESHOLD && !target.isChaos) {
      target.isChaos = true;
      battle.addCombatLog({
        action: 'CHAOS',
        targetUnitId: target.unitId,
        description: `[혼란] ${GROUND_UNIT_SPECS[target.type].nameKo} 부대 사기 붕괴!`
      });
    }
    
    // 처치 보너스
    if (target.isDestroyed) {
      attacker.stats.morale = Math.min(100, attacker.stats.morale + GROUND_COMBAT_CONSTANTS.MORALE_KILL_BONUS);
    }
  }
  
  /**
   * 점령 처리
   */
  private async processConquest(battle: IGroundBattle): Promise<void> {
    // 점령 속도 계산
    const aliveAttackers = battle.attackerUnits.filter(u => !u.isDestroyed && !u.isChaos);
    
    let conquestRate = 0;
    for (const unit of aliveAttackers) {
      conquestRate += GROUND_COMBAT_CONSTANTS.CONQUEST_BASE_RATE;
      conquestRate += unit.count * unit.stats.conquestPower * GROUND_COMBAT_CONSTANTS.CONQUEST_INFANTRY_BONUS;
    }
    
    // 지형 배수 적용
    conquestRate *= battle.terrainModifier.conquestMultiplier;
    
    battle.conquestRate = conquestRate;
    battle.conquestGauge = Math.min(100, battle.conquestGauge + conquestRate);
    
    battle.addCombatLog({
      action: 'CONQUEST_TICK',
      conquestGaugeChange: conquestRate,
      description: `점령 진행: ${battle.conquestGauge.toFixed(1)}% (+${conquestRate.toFixed(1)}%)`
    });
    
    // 점령 완료
    if (battle.conquestGauge >= 100) {
      await this.endBattle(battle, 'ATTACKER_WIN');
    }
  }
  
  /**
   * 철수 처리
   */
  private processRetreats(battle: IGroundBattle): void {
    // 철수 중인 유닛 제거 (철수 시간 후)
    for (const unit of [...battle.attackerUnits, ...battle.defenderUnits]) {
      if (unit.isRetreating && !unit.isDestroyed) {
        // 실제로는 타이머 기반으로 처리해야 함
        // 간단하게 즉시 제거
        unit.isDestroyed = true;
        battle.addCombatLog({
          action: 'RETREAT',
          sourceUnitId: unit.unitId,
          description: `[철수 완료] ${GROUND_UNIT_SPECS[unit.type].nameKo} 부대 전장 이탈`
        });
      }
    }
  }
  
  /**
   * 사기 회복
   */
  private recoverMorale(battle: IGroundBattle): void {
    for (const unit of [...battle.attackerUnits, ...battle.defenderUnits]) {
      if (!unit.isDestroyed && !unit.isChaos) {
        unit.stats.morale = Math.min(100, unit.stats.morale + GROUND_COMBAT_CONSTANTS.MORALE_RECOVERY_RATE);
      }
      
      // 혼란 상태 회복 (사기가 40 이상이면)
      if (unit.isChaos && unit.stats.morale >= 40) {
        unit.isChaos = false;
        battle.addCombatLog({
          action: 'ATTACK',
          sourceUnitId: unit.unitId,
          description: `[회복] ${GROUND_UNIT_SPECS[unit.type].nameKo} 부대 전열 재정비`
        });
      }
    }
  }
  
  /**
   * 승리 조건 확인
   */
  private async checkVictoryConditions(battle: IGroundBattle): Promise<void> {
    const aliveAttackers = battle.attackerUnits.filter(u => !u.isDestroyed);
    const aliveDefenders = battle.defenderUnits.filter(u => !u.isDestroyed);
    
    // 공격측 전멸
    if (aliveAttackers.length === 0 && battle.attackerDropQueue.length === 0) {
      await this.endBattle(battle, 'DEFENDER_WIN');
      return;
    }
    
    // 방어측 전멸 + 점령 완료
    if (aliveDefenders.length === 0 && battle.conquestGauge >= 100) {
      await this.endBattle(battle, 'ATTACKER_WIN');
      return;
    }
    
    // 모든 공격 유닛 철수
    const activeAttackers = aliveAttackers.filter(u => !u.isRetreating);
    if (activeAttackers.length === 0 && battle.attackerDropQueue.length === 0) {
      await this.endBattle(battle, 'ATTACKER_RETREAT');
      return;
    }
  }
  
  /**
   * 전투 종료
   */
  private async endBattle(battle: IGroundBattle, result: GroundBattleResult): Promise<void> {
    battle.status = 'ENDED';
    battle.result = result;
    battle.endedAt = new Date();
    
    this.stopBattleLoop(battle.battleId);
    
    // 손실 집계
    const attackerCasualties = battle.attackerUnits
      .filter(u => u.isDestroyed)
      .reduce((sum, u) => sum + (GROUND_UNIT_SPECS[u.type].cost.credits * u.count), 0);
    const defenderCasualties = battle.defenderUnits
      .filter(u => u.isDestroyed)
      .reduce((sum, u) => sum + (GROUND_UNIT_SPECS[u.type].cost.credits * u.count), 0);
    
    logger.info('[GroundCombatService] Battle ended', {
      battleId: battle.battleId,
      result,
      attackerCasualties,
      defenderCasualties
    });
    
    // 점령 처리
    if (result === 'ATTACKER_WIN') {
      await this.processConquestResult(battle);
    }
    
    this.emit('GROUND_BATTLE_END', {
      battleId: battle.battleId,
      sessionId: battle.sessionId,
      planetId: battle.planetId,
      result,
      winnerId: result === 'ATTACKER_WIN' ? battle.attackerFactionId : 
               result === 'DEFENDER_WIN' ? battle.defenderFactionId : null,
      casualties: {
        attacker: attackerCasualties,
        defender: defenderCasualties
      }
    } as GroundBattleEndEvent);
    
    await battle.save();
  }
  
  /**
   * 점령 결과 처리 (소유권 이전)
   */
  private async processConquestResult(battle: IGroundBattle): Promise<void> {
    const planet = await Planet.findOne({ 
      sessionId: battle.sessionId, 
      planetId: battle.planetId 
    });
    
    if (!planet) return;
    
    const previousOwner = planet.ownerId;
    planet.ownerId = battle.attackerFactionId;
    planet.loyalty = 30; // 점령 직후 충성도 낮음
    planet.morale = 40;  // 점령 직후 사기 낮음
    planet.garrisonIds = []; // 수비대 초기화
    
    await planet.save();
    
    logger.info('[GroundCombatService] Planet conquered', {
      planetId: battle.planetId,
      previousOwner,
      newOwner: battle.attackerFactionId
    });
    
    this.emit('PLANET_CONQUERED', {
      sessionId: battle.sessionId,
      planetId: battle.planetId,
      previousOwnerId: previousOwner,
      newOwnerId: battle.attackerFactionId,
      battleId: battle.battleId
    } as PlanetConqueredEvent);
  }
  
  // ============================================================
  // Deployment (강하/철수)
  // ============================================================
  
  /**
   * 유닛 강하 (함대에서 지상으로)
   */
  async dropUnits(params: {
    battleId: string;
    fleetId: string;
    unitType: GroundUnitType;
    count: number;
  }): Promise<IDropQueueItem> {
    const { battleId, fleetId, unitType, count } = params;
    
    const battle = await GroundBattle.findOne({ battleId });
    if (!battle) {
      throw new Error(`Battle not found: ${battleId}`);
    }
    if (battle.status === 'ENDED') {
      throw new Error('Cannot drop units to ended battle');
    }
    
    const fleet = await Fleet.findOne({ fleetId });
    if (!fleet) {
      throw new Error(`Fleet not found: ${fleetId}`);
    }
    
    // 유닛 수 제한 확인
    const currentUnits = fleet.factionId === battle.attackerFactionId 
      ? battle.attackerUnits.filter(u => !u.isDestroyed).length + battle.attackerDropQueue.length
      : battle.defenderUnits.filter(u => !u.isDestroyed).length + battle.defenderDropQueue.length;
    
    if (currentUnits >= battle.maxUnitsPerSide) {
      throw new Error(`Maximum units reached (${battle.maxUnitsPerSide})`);
    }
    
    // 병력 수 제한
    const actualCount = Math.min(count, GROUND_COMBAT_CONSTANTS.MAX_TROOPS_PER_UNIT);
    
    // 강하 시간 계산
    const dropTime = GROUND_UNIT_SPECS[unitType].dropTime * GROUND_COMBAT_CONSTANTS.TICK_INTERVAL_MS;
    const expectedDropAt = new Date(Date.now() + dropTime);
    
    const dropItem: IDropQueueItem = {
      unitId: `DROP-${uuidv4().slice(0, 8)}`,
      fleetId,
      factionId: fleet.factionId,
      unitType,
      count: actualCount,
      queuedAt: new Date(),
      expectedDropAt
    };
    
    // 대기열에 추가
    if (fleet.factionId === battle.attackerFactionId) {
      battle.attackerDropQueue.push(dropItem);
    } else if (fleet.factionId === battle.defenderFactionId) {
      battle.defenderDropQueue.push(dropItem);
    } else {
      throw new Error('Fleet faction does not match battle participants');
    }
    
    // 상태 업데이트
    if (battle.status === 'WAITING') {
      battle.status = 'DROPPING';
    }
    
    battle.addCombatLog({
      action: 'ATTACK',
      description: `[강하 개시] ${GROUND_UNIT_SPECS[unitType].nameKo} ${actualCount}명 강하 중...`
    });
    
    await battle.save();
    
    // 전투 루프 시작 (아직 시작 안했으면)
    if (!this.activeLoops.has(battleId)) {
      this.startBattleLoop(battleId);
    }
    
    logger.info('[GroundCombatService] Units dropping', {
      battleId,
      fleetId,
      unitType,
      count: actualCount,
      expectedDropAt
    });
    
    return dropItem;
  }
  
  /**
   * 유닛 철수 (지상에서 함대로)
   */
  async withdrawUnit(params: {
    battleId: string;
    unitId: string;
  }): Promise<void> {
    const { battleId, unitId } = params;
    
    const battle = await GroundBattle.findOne({ battleId });
    if (!battle) {
      throw new Error(`Battle not found: ${battleId}`);
    }
    if (battle.status === 'ENDED') {
      throw new Error('Cannot withdraw from ended battle');
    }
    
    // 유닛 찾기
    const unit = battle.attackerUnits.find(u => u.unitId === unitId) ||
                 battle.defenderUnits.find(u => u.unitId === unitId);
    
    if (!unit) {
      throw new Error(`Unit not found: ${unitId}`);
    }
    if (unit.isDestroyed) {
      throw new Error('Cannot withdraw destroyed unit');
    }
    if (unit.isRetreating) {
      throw new Error('Unit is already retreating');
    }
    
    // 철수 페널티 (전투 중이면 병력 손실)
    if (battle.status === 'COMBAT') {
      const casualties = Math.floor(unit.count * GROUND_COMBAT_CONSTANTS.WITHDRAW_PENALTY);
      unit.count = Math.max(1, unit.count - casualties);
      
      battle.addCombatLog({
        action: 'RETREAT',
        sourceUnitId: unitId,
        damage: casualties,
        description: `[전투 중 철수] ${GROUND_UNIT_SPECS[unit.type].nameKo} 부대 ${casualties}명 손실`
      });
    }
    
    unit.isRetreating = true;
    
    battle.addCombatLog({
      action: 'RETREAT',
      sourceUnitId: unitId,
      description: `[철수 명령] ${GROUND_UNIT_SPECS[unit.type].nameKo} 부대 철수 시작`
    });
    
    await battle.save();
    
    logger.info('[GroundCombatService] Unit withdrawing', {
      battleId,
      unitId,
      remainingCount: unit.count
    });
  }
  
  // ============================================================
  // Orbital Strike (궤도 폭격)
  // ============================================================
  
  /**
   * 궤도 폭격 요청
   */
  async requestOrbitalStrike(params: {
    battleId: string;
    targetSide: 'attacker' | 'defender';
    requestingFactionId: string;
  }): Promise<{ success: boolean; damage: number; friendlyFire: boolean }> {
    const { battleId, targetSide, requestingFactionId } = params;
    
    const battle = await GroundBattle.findOne({ battleId });
    if (!battle) {
      throw new Error(`Battle not found: ${battleId}`);
    }
    if (battle.status !== 'COMBAT') {
      throw new Error('Orbital strike only available during combat');
    }
    if (!battle.orbitalStrike.available) {
      throw new Error('Orbital strike not available');
    }
    
    // 쿨다운 확인
    if (battle.orbitalStrike.lastUsedTick !== undefined) {
      const ticksSinceLastUse = battle.currentTick - battle.orbitalStrike.lastUsedTick;
      if (ticksSinceLastUse < battle.orbitalStrike.cooldownTicks) {
        throw new Error(`Orbital strike on cooldown (${battle.orbitalStrike.cooldownTicks - ticksSinceLastUse} ticks remaining)`);
      }
    }
    
    // 요청자가 공격/방어측인지 확인
    const isAttacker = requestingFactionId === battle.attackerFactionId;
    const isDefender = requestingFactionId === battle.defenderFactionId;
    if (!isAttacker && !isDefender) {
      throw new Error('Requesting faction is not a battle participant');
    }
    
    // 아군 오폭 확률 체크
    const friendlyFire = Math.random() * 100 < battle.orbitalStrike.friendlyFireRisk;
    
    // 타겟 유닛들
    let targetUnits: IGroundUnit[];
    if (friendlyFire) {
      // 오폭! 아군 타격
      targetUnits = isAttacker ? battle.attackerUnits : battle.defenderUnits;
      battle.addCombatLog({
        action: 'ORBITAL_STRIKE',
        description: `⚠️ [궤도 폭격 오폭!] 아군에게 피해 발생!`
      });
    } else {
      // 정상 타격
      targetUnits = targetSide === 'attacker' ? battle.attackerUnits : battle.defenderUnits;
    }
    
    // 데미지 분배
    const aliveTargets = targetUnits.filter(u => !u.isDestroyed);
    if (aliveTargets.length === 0) {
      return { success: false, damage: 0, friendlyFire };
    }
    
    const damagePerUnit = Math.floor(GROUND_COMBAT_CONSTANTS.ORBITAL_STRIKE_DAMAGE / aliveTargets.length);
    let totalDamage = 0;
    
    for (const unit of aliveTargets) {
      unit.stats.hp -= damagePerUnit;
      unit.damageTaken += damagePerUnit;
      totalDamage += damagePerUnit;
      
      // 병력 손실
      if (unit.stats.hp <= 0) {
        const casualties = Math.ceil(unit.count * 0.3);
        unit.count = Math.max(0, unit.count - casualties);
        unit.stats.hp = unit.stats.maxHp;
        
        if (unit.count <= 0) {
          unit.isDestroyed = true;
        }
      }
      
      // 사기 대폭 감소
      unit.stats.morale = Math.max(0, unit.stats.morale - 30);
      if (unit.stats.morale <= GROUND_COMBAT_CONSTANTS.MORALE_CHAOS_THRESHOLD) {
        unit.isChaos = true;
      }
    }
    
    // 쿨다운 설정
    battle.orbitalStrike.lastUsedTick = battle.currentTick;
    
    battle.addCombatLog({
      action: 'ORBITAL_STRIKE',
      damage: totalDamage,
      description: `🔥 [궤도 폭격] 총 ${totalDamage} 데미지, ${aliveTargets.length}개 부대 피해`
    });
    
    await battle.save();
    
    logger.info('[GroundCombatService] Orbital strike executed', {
      battleId,
      totalDamage,
      friendlyFire,
      targetsHit: aliveTargets.length
    });
    
    return { success: true, damage: totalDamage, friendlyFire };
  }
  
  // ============================================================
  // Query Methods
  // ============================================================
  
  /**
   * 전투 정보 조회
   */
  async getBattle(battleId: string): Promise<IGroundBattle | null> {
    return GroundBattle.findOne({ battleId });
  }
  
  /**
   * 행성의 활성 전투 조회
   */
  async getActiveBattleOnPlanet(sessionId: string, planetId: string): Promise<IGroundBattle | null> {
    return GroundBattle.findOne({
      sessionId,
      planetId,
      status: { $ne: 'ENDED' }
    });
  }
  
  /**
   * 팩션의 모든 전투 조회
   */
  async getFactionBattles(sessionId: string, factionId: string): Promise<IGroundBattle[]> {
    return GroundBattle.find({
      sessionId,
      $or: [
        { attackerFactionId: factionId },
        { defenderFactionId: factionId }
      ]
    }).sort({ createdAt: -1 });
  }
  
  // ============================================================
  // Cleanup
  // ============================================================
  
  /**
   * 모든 활성 루프 정지
   */
  stopAllLoops(): void {
    for (const [battleId, loop] of this.activeLoops) {
      clearInterval(loop);
      logger.info('[GroundCombatService] Loop stopped', { battleId });
    }
    this.activeLoops.clear();
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const groundCombatService = new GroundCombatService();

