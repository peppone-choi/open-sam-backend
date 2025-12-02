/**
 * LOGH Realtime Combat Engine
 * 은하영웅전설 스타일 실시간 전투 엔진
 * 
 * 특징:
 * - 연속 좌표 시스템 (10000x10000)
 * - deltaTime 기반 이동 (50ms tick, 20 ticks/sec)
 * - 5가지 진형: 어린, 학익, 방원, 봉시, 장사
 * - 사정거리 기반 자동 공격
 * - 보급 시스템: 보급 부족 시 전투력 50% 감소
 * - WebSocket 실시간 통신
 */

import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { TacticalMap, ITacticalMap } from '../../models/logh/TacticalMap.model';
import { v4 as uuidv4 } from 'uuid';
import {
  Formation,
  FormationStats,
  FORMATION_STATS,
  COMBAT_CONSTANTS,
  Position2D,
  Velocity2D,
  CombatEvent,
  CombatEventType,
  FleetCombatState,
  BattleState,
  BattleResult,
  getDistance,
  normalize,
  vectorToAngle,
  angleToVector,
  clamp,
  getSupplyMultiplier,
  getFormationStats,
} from './types/Combat.types';

// ============================================================================
// Combat Engine Class
// ============================================================================

export class RealtimeCombatEngine {
  private sessionId: string;
  private tacticalMapId: string;
  private isRunning: boolean = false;
  private tickCount: number = 0;
  private lastTickTime: number = 0;
  private tickInterval: NodeJS.Timeout | null = null;
  private eventBuffer: CombatEvent[] = [];
  private onStateUpdate?: (state: BattleState) => void;

  constructor(sessionId: string, tacticalMapId: string) {
    this.sessionId = sessionId;
    this.tacticalMapId = tacticalMapId;
  }

  // ==========================================================================
  // Engine Control
  // ==========================================================================

  /**
   * 전투 엔진 시작
   */
  start(onStateUpdate?: (state: BattleState) => void): void {
    if (this.isRunning) {
      console.warn('[CombatEngine] Already running');
      return;
    }

    console.log(`[CombatEngine] Starting battle: ${this.tacticalMapId}`);
    this.isRunning = true;
    this.tickCount = 0;
    this.lastTickTime = Date.now();
    this.onStateUpdate = onStateUpdate;

    // 50ms 간격으로 tick 실행 (20 ticks/sec)
    this.tickInterval = setInterval(() => {
      this.tick();
    }, COMBAT_CONSTANTS.TICK_INTERVAL_MS);
  }

  /**
   * 전투 엔진 정지
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log(`[CombatEngine] Stopping battle: ${this.tacticalMapId}`);
    this.isRunning = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * 전투 엔진 상태
   */
  getStatus(): { isRunning: boolean; tickCount: number } {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
    };
  }

  // ==========================================================================
  // Main Game Loop
  // ==========================================================================

  /**
   * 메인 틱 처리 (50ms 마다 호출)
   */
  private async tick(): Promise<void> {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastTickTime) / 1000; // 초 단위
    this.lastTickTime = currentTime;
    this.tickCount++;

    try {
      // 참여 함대 조회
      const fleets = await this.getParticipatingFleets();
      if (fleets.length === 0) {
        this.stop();
        return;
      }

      // 1. 보급 소모 처리
      await this.processSupplyConsumption(fleets, deltaTime);

      // 2. 이동 처리
      await this.processMovement(fleets, deltaTime);

      // 3. 회전 처리
      await this.processRotation(fleets, deltaTime);

      // 4. 전투 처리 (사정거리 내 자동 공격)
      await this.processCombat(fleets, deltaTime);

      // 5. 사기 처리
      await this.processMorale(fleets, deltaTime);

      // 6. 전투 종료 조건 체크
      const battleEnded = await this.checkBattleEnd(fleets);

      // 7. 상태 브로드캐스트
      if (this.onStateUpdate) {
        const state = await this.buildBattleState(fleets);
        this.onStateUpdate(state);
      }

      // 8. 이벤트 버퍼 초기화
      this.eventBuffer = [];

      if (battleEnded) {
        await this.concludeBattle(fleets);
        this.stop();
      }
    } catch (error) {
      console.error('[CombatEngine] Tick error:', error);
    }
  }

  // ==========================================================================
  // Fleet Queries
  // ==========================================================================

  /**
   * 참여 함대 조회
   */
  private async getParticipatingFleets(): Promise<IFleet[]> {
    return Fleet.find({
      session_id: this.sessionId,
      tacticalMapId: this.tacticalMapId,
      isInCombat: true,
      status: { $ne: 'destroyed' },
    });
  }

  // ==========================================================================
  // Supply System (보급 시스템)
  // ==========================================================================

  /**
   * 보급 소모 처리
   * - 전투 중에는 보급 소모 3배
   * - 보급 20% 이하 시 전투력 50% 감소
   */
  private async processSupplyConsumption(
    fleets: IFleet[],
    deltaTime: number
  ): Promise<void> {
    for (const fleet of fleets) {
      // 시간당 소모량 → 초당 소모량
      const hourlyConsumption = 
        fleet.totalShips * COMBAT_CONSTANTS.SUPPLY_CONSUMPTION_PER_SHIP_PER_HOUR;
      const secondlyConsumption = hourlyConsumption / 3600;
      
      // 전투 중 보급 소모 배율 적용
      const combatMultiplier = fleet.isInCombat 
        ? COMBAT_CONSTANTS.SUPPLY_COMBAT_MULTIPLIER 
        : 1;
      
      const consumption = secondlyConsumption * combatMultiplier * deltaTime;
      
      // 보급 감소
      const previousSupply = fleet.supplies;
      fleet.supplies = Math.max(0, fleet.supplies - consumption);

      // 보급 경고 이벤트 (20% 이하로 떨어질 때)
      const previousPercent = this.getSupplyPercent(previousSupply, fleet);
      const currentPercent = this.getSupplyPercent(fleet.supplies, fleet);
      
      if (previousPercent > COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD &&
          currentPercent <= COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD) {
        this.addEvent({
          type: 'supply_depleted',
          timestamp: Date.now(),
          sourceFleetId: fleet.fleetId,
          details: { supplyPercent: currentPercent },
        });
      }

      await fleet.save();
    }
  }

  /**
   * 보급 퍼센트 계산
   */
  private getSupplyPercent(supplies: number, fleet: IFleet): number {
    const maxSupply = fleet.totalShips * 100; // 함선당 기본 보급량 100
    return maxSupply > 0 ? (supplies / maxSupply) * 100 : 0;
  }

  /**
   * 보급 상태에 따른 전투력 배율
   */
  private getFleetSupplyMultiplier(fleet: IFleet): number {
    const supplyPercent = this.getSupplyPercent(fleet.supplies, fleet);
    return getSupplyMultiplier(supplyPercent);
  }

  // ==========================================================================
  // Movement System (이동 시스템)
  // ==========================================================================

  /**
   * 함대 이동 처리
   * velocity 벡터 × deltaTime × 속도 배율
   */
  private async processMovement(
    fleets: IFleet[],
    deltaTime: number
  ): Promise<void> {
    for (const fleet of fleets) {
      if (!fleet.tacticalPosition || !fleet.isMoving) continue;

      const velocity = fleet.tacticalPosition.velocity || { x: 0, y: 0 };
      if (velocity.x === 0 && velocity.y === 0) continue;

      // 진형에 따른 속도 배율
      const formation = this.mapFormation(fleet.formation);
      const formationStats = getFormationStats(formation);
      const speedMultiplier = formationStats.speed;

      // 실제 이동 속도
      const effectiveSpeed = fleet.movementSpeed * speedMultiplier;

      // 위치 업데이트
      const oldX = fleet.tacticalPosition.x;
      const oldY = fleet.tacticalPosition.y;

      fleet.tacticalPosition.x += velocity.x * effectiveSpeed * deltaTime;
      fleet.tacticalPosition.y += velocity.y * effectiveSpeed * deltaTime;

      // 경계 체크 (0 ~ 10000)
      fleet.tacticalPosition.x = clamp(
        fleet.tacticalPosition.x,
        0,
        COMBAT_CONSTANTS.TACTICAL_MAP_SIZE
      );
      fleet.tacticalPosition.y = clamp(
        fleet.tacticalPosition.y,
        0,
        COMBAT_CONSTANTS.TACTICAL_MAP_SIZE
      );

      // 목적지 도달 여부 확인
      if (fleet.destination) {
        const distance = getDistance(
          fleet.tacticalPosition,
          fleet.destination
        );

        if (distance < COMBAT_CONSTANTS.ARRIVAL_THRESHOLD) {
          // 목적지 도달
          fleet.isMoving = false;
          fleet.destination = undefined;
          fleet.tacticalPosition.velocity = { x: 0, y: 0 };
        }
      }

      await fleet.save();
    }
  }

  /**
   * 함대 회전 처리
   */
  private async processRotation(
    fleets: IFleet[],
    deltaTime: number
  ): Promise<void> {
    for (const fleet of fleets) {
      if (!fleet.tacticalPosition) continue;

      const velocity = fleet.tacticalPosition.velocity || { x: 0, y: 0 };
      if (velocity.x === 0 && velocity.y === 0) continue;

      // 목표 각도 계산
      const targetHeading = vectorToAngle(velocity);
      const currentHeading = fleet.tacticalPosition.heading || 0;

      // 각도 차이 계산 (-180 ~ 180)
      let angleDiff = targetHeading - currentHeading;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      // 최대 회전 속도 제한
      const maxRotation = COMBAT_CONSTANTS.BASE_TURN_RATE * deltaTime;
      const rotation = clamp(angleDiff, -maxRotation, maxRotation);

      // 각도 업데이트
      fleet.tacticalPosition.heading = (currentHeading + rotation + 360) % 360;

      await fleet.save();
    }
  }

  // ==========================================================================
  // Combat System (전투 시스템)
  // ==========================================================================

  /**
   * 전투 처리
   * 사정거리 내 적 함대 자동 공격
   */
  private async processCombat(
    fleets: IFleet[],
    deltaTime: number
  ): Promise<void> {
    for (const attacker of fleets) {
      if (!attacker.tacticalPosition) continue;
      if (attacker.status === 'retreating') continue;

      // 적 찾기
      const enemies = fleets.filter(
        (f) =>
          f.faction !== attacker.faction &&
          f.tacticalPosition &&
          f.totalShips > 0 &&
          f.status !== 'destroyed'
      );

      // 가장 가까운 적 타겟팅
      let nearestEnemy: IFleet | null = null;
      let nearestDistance = Infinity;

      for (const enemy of enemies) {
        const distance = getDistance(
          attacker.tacticalPosition,
          enemy.tacticalPosition!
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = enemy;
        }
      }

      if (!nearestEnemy) continue;

      // 사정거리 계산 (진형 보정 적용)
      const formation = this.mapFormation(attacker.formation);
      const formationStats = getFormationStats(formation);
      const effectiveRange = 
        (attacker.combatRange || COMBAT_CONSTANTS.BASE_ATTACK_RANGE) * 
        formationStats.range;

      // 사정거리 내일 때만 공격
      if (nearestDistance <= effectiveRange) {
        const damage = this.calculateDamage(
          attacker,
          nearestEnemy,
          deltaTime
        );

        if (damage > 0) {
          // 피해 적용
          this.applyDamage(nearestEnemy, damage);

          // 이벤트 기록
          this.addEvent({
            type: nearestEnemy.totalShips <= 0 ? 'destroy' : 'hit',
            timestamp: Date.now(),
            sourceFleetId: attacker.fleetId,
            targetFleetId: nearestEnemy.fleetId,
            damage,
          });

          await nearestEnemy.save();
        }
      }
    }
  }

  /**
   * 데미지 계산
   * 
   * 공식:
   * baseDamage = 공격력 / 100 (초당 기본 데미지)
   * × 진형 공격 배율
   * × 제독 전투 보너스
   * × 보급 배율 (부족 시 50%)
   * × deltaTime
   * - 방어력 감소
   */
  private calculateDamage(
    attacker: IFleet,
    defender: IFleet,
    deltaTime: number
  ): number {
    // 기본 공격력
    let attackPower = attacker.totalStrength / 100;
    let defensePower = defender.totalStrength / 200;

    // 진형 보정
    const attackerFormation = this.mapFormation(attacker.formation);
    const defenderFormation = this.mapFormation(defender.formation);
    const attackerStats = getFormationStats(attackerFormation);
    const defenderStats = getFormationStats(defenderFormation);

    attackPower *= attackerStats.attack;
    defensePower *= defenderStats.defense;

    // 보급 배율 (부족 시 50%)
    const supplyMultiplier = this.getFleetSupplyMultiplier(attacker);
    attackPower *= supplyMultiplier;

    // 회피 계산
    const evasionChance = (defenderStats.evasion / 100);
    const hitChance = Math.max(0.1, 1 - evasionChance);

    // 최종 데미지
    const baseDamage = (attackPower - defensePower) * deltaTime;
    const finalDamage = baseDamage * hitChance;

    return Math.max(0, Math.floor(finalDamage));
  }

  /**
   * 데미지 적용
   */
  private applyDamage(fleet: IFleet, damage: number): void {
    // 함선 손실
    const shipsLost = Math.min(damage, fleet.totalShips);
    fleet.totalShips = Math.max(0, fleet.totalShips - shipsLost);
    fleet.totalStrength = Math.max(0, fleet.totalStrength - shipsLost * 10);

    // 사기 감소
    const moraleLoss = shipsLost * COMBAT_CONSTANTS.MORALE_LOSS_PER_CASUALTY;
    fleet.morale = Math.max(0, fleet.morale - moraleLoss);

    // 파괴 판정
    if (fleet.totalShips <= 0) {
      fleet.status = 'destroyed';
      fleet.isInCombat = false;
    }
  }

  // ==========================================================================
  // Morale System (사기 시스템)
  // ==========================================================================

  /**
   * 사기 처리
   * - 보급 부족 시 지속적 사기 감소
   * - 사기 10 이하: 항복 가능성
   * - 사기 0: 궤멸
   */
  private async processMorale(
    fleets: IFleet[],
    deltaTime: number
  ): Promise<void> {
    for (const fleet of fleets) {
      // 보급 부족 시 사기 감소
      const supplyPercent = this.getSupplyPercent(fleet.supplies, fleet);
      if (supplyPercent <= COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD) {
        fleet.morale = Math.max(
          0,
          fleet.morale - COMBAT_CONSTANTS.MORALE_LOSS_LOW_SUPPLY * deltaTime
        );
      }

      // 궤멸 판정
      if (fleet.morale <= COMBAT_CONSTANTS.MORALE_ROUT_THRESHOLD) {
        this.addEvent({
          type: 'rout',
          timestamp: Date.now(),
          sourceFleetId: fleet.fleetId,
        });
        fleet.status = 'destroyed';
        fleet.isInCombat = false;
      }
      // 항복 판정 (10% 확률)
      else if (fleet.morale <= COMBAT_CONSTANTS.MORALE_SURRENDER_THRESHOLD) {
        if (Math.random() < 0.1 * deltaTime) {
          this.addEvent({
            type: 'surrender',
            timestamp: Date.now(),
            sourceFleetId: fleet.fleetId,
          });
          fleet.status = 'retreating';
        }
      }

      await fleet.save();
    }
  }

  // ==========================================================================
  // Battle End
  // ==========================================================================

  /**
   * 전투 종료 조건 체크
   */
  private async checkBattleEnd(fleets: IFleet[]): Promise<boolean> {
    const activeFleets = fleets.filter(
      (f) => f.status !== 'destroyed' && f.status !== 'retreating'
    );

    const empireFleetsAlive = activeFleets.filter(
      (f) => f.faction === 'empire' && f.totalShips > 0
    ).length;
    const allianceFleetsAlive = activeFleets.filter(
      (f) => f.faction === 'alliance' && f.totalShips > 0
    ).length;

    // 한쪽 전멸
    return empireFleetsAlive === 0 || allianceFleetsAlive === 0;
  }

  /**
   * 전투 종료 처리
   */
  private async concludeBattle(fleets: IFleet[]): Promise<void> {
    const tacticalMap = await TacticalMap.findOne({
      session_id: this.sessionId,
      tacticalMapId: this.tacticalMapId,
    });

    if (!tacticalMap) return;

    // 결과 계산
    const empireFleets = fleets.filter((f) => f.faction === 'empire');
    const allianceFleets = fleets.filter((f) => f.faction === 'alliance');

    const empireShipsRemaining = empireFleets.reduce(
      (sum, f) => sum + f.totalShips,
      0
    );
    const allianceShipsRemaining = allianceFleets.reduce(
      (sum, f) => sum + f.totalShips,
      0
    );

    let winner: 'empire' | 'alliance' | 'draw';
    if (empireShipsRemaining > 0 && allianceShipsRemaining === 0) {
      winner = 'empire';
    } else if (allianceShipsRemaining > 0 && empireShipsRemaining === 0) {
      winner = 'alliance';
    } else {
      winner = 'draw';
    }

    // 함대 상태 초기화
    for (const fleet of fleets) {
      fleet.isInCombat = false;
      fleet.tacticalMapId = undefined;
      fleet.tacticalPosition = undefined;
      fleet.status = fleet.totalShips > 0 ? 'idle' : 'destroyed';
      await fleet.save();
    }

    // 전술 맵 업데이트
    tacticalMap.status = 'concluded';
    tacticalMap.endTime = new Date();
    tacticalMap.result = {
      winner,
      casualties: {
        empire: empireFleets.reduce((sum, f) => sum + f.totalShips, 0),
        alliance: allianceFleets.reduce((sum, f) => sum + f.totalShips, 0),
      },
    };

    await tacticalMap.save();

    console.log(`[CombatEngine] Battle concluded. Winner: ${winner}`);
  }

  // ==========================================================================
  // State Building
  // ==========================================================================

  /**
   * 전투 상태 객체 생성
   */
  private async buildBattleState(fleets: IFleet[]): Promise<BattleState> {
    const fleetStates: FleetCombatState[] = fleets.map((f) => {
      const formation = this.mapFormation(f.formation);
      const formationStats = getFormationStats(formation);
      const supplyMultiplier = this.getFleetSupplyMultiplier(f);
      const supplyPercent = this.getSupplyPercent(f.supplies, f);

      return {
        fleetId: f.fleetId,
        name: f.name,
        faction: f.faction,
        position: {
          x: f.tacticalPosition?.x || 0,
          y: f.tacticalPosition?.y || 0,
        },
        velocity: f.tacticalPosition?.velocity || { x: 0, y: 0 },
        heading: f.tacticalPosition?.heading || 0,
        targetPosition: f.destination,
        formation,
        totalShips: f.totalShips,
        totalStrength: f.totalStrength,
        morale: f.morale,
        supply: f.supplies,
        effectiveAttack: (f.totalStrength / 100) * formationStats.attack * supplyMultiplier,
        effectiveDefense: (f.totalStrength / 200) * formationStats.defense,
        effectiveRange: (f.combatRange || COMBAT_CONSTANTS.BASE_ATTACK_RANGE) * formationStats.range,
        effectiveSpeed: f.movementSpeed * formationStats.speed,
        isMoving: f.isMoving,
        isInCombat: f.isInCombat,
        isRetreating: f.status === 'retreating',
        hasLowSupply: supplyPercent <= COMBAT_CONSTANTS.LOW_SUPPLY_THRESHOLD,
      };
    });

    return {
      tacticalMapId: this.tacticalMapId,
      sessionId: this.sessionId,
      tick: this.tickCount,
      timestamp: Date.now(),
      fleets: fleetStates,
      events: [...this.eventBuffer],
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * 이벤트 추가
   */
  private addEvent(event: CombatEvent): void {
    this.eventBuffer.push(event);
  }

  /**
   * 기존 진형을 새 Formation 타입으로 매핑
   */
  private mapFormation(formation: string | undefined): Formation {
    const mapping: Record<string, Formation> = {
      standard: 'fishScale',
      offensive: 'arrowhead',
      defensive: 'circular',
      encircle: 'craneWing',
      retreat: 'longSnake',
      // 새 진형 이름도 지원
      fishScale: 'fishScale',
      craneWing: 'craneWing',
      circular: 'circular',
      arrowhead: 'arrowhead',
      longSnake: 'longSnake',
    };
    return mapping[formation || 'standard'] || 'fishScale';
  }

  // ==========================================================================
  // Public Commands
  // ==========================================================================

  /**
   * 함대 이동 명령
   */
  async moveFleet(fleetId: string, destination: Position2D): Promise<boolean> {
    const fleet = await Fleet.findOne({
      session_id: this.sessionId,
      fleetId,
      tacticalMapId: this.tacticalMapId,
    });

    if (!fleet || !fleet.tacticalPosition) {
      return false;
    }

    // 목적지 설정
    fleet.destination = destination;
    fleet.isMoving = true;

    // 방향 벡터 계산
    const dx = destination.x - fleet.tacticalPosition.x;
    const dy = destination.y - fleet.tacticalPosition.y;
    const normalized = normalize({ x: dx, y: dy });

    fleet.tacticalPosition.velocity = normalized;

    await fleet.save();
    return true;
  }

  /**
   * 진형 변경 명령
   */
  async changeFormation(fleetId: string, formation: Formation): Promise<boolean> {
    const fleet = await Fleet.findOne({
      session_id: this.sessionId,
      fleetId,
      tacticalMapId: this.tacticalMapId,
    });

    if (!fleet) {
      return false;
    }

    // 새 진형을 기존 formation 필드에 저장
    // (Fleet 모델이 새 Formation 타입을 지원할 때까지)
    const legacyMapping: Record<Formation, string> = {
      fishScale: 'offensive',
      craneWing: 'encircle',
      circular: 'defensive',
      arrowhead: 'offensive',
      longSnake: 'retreat',
    };
    
    fleet.formation = legacyMapping[formation] as any;
    await fleet.save();

    this.addEvent({
      type: 'shot', // placeholder - 진형 변경 이벤트 타입 필요
      timestamp: Date.now(),
      sourceFleetId: fleetId,
      details: { newFormation: formation },
    });

    return true;
  }

  /**
   * 후퇴 명령
   */
  async retreat(fleetId: string): Promise<boolean> {
    const fleet = await Fleet.findOne({
      session_id: this.sessionId,
      fleetId,
      tacticalMapId: this.tacticalMapId,
    });

    if (!fleet || !fleet.tacticalPosition) {
      return false;
    }

    fleet.status = 'retreating';
    fleet.formation = 'retreat';

    // 맵 경계로 후퇴
    const exitX = fleet.faction === 'empire' ? 0 : COMBAT_CONSTANTS.TACTICAL_MAP_SIZE;
    const exitY = fleet.tacticalPosition.y;

    await this.moveFleet(fleetId, { x: exitX, y: exitY });

    this.addEvent({
      type: 'retreat',
      timestamp: Date.now(),
      sourceFleetId: fleetId,
    });

    return true;
  }

  /**
   * 정지 명령
   */
  async holdPosition(fleetId: string): Promise<boolean> {
    const fleet = await Fleet.findOne({
      session_id: this.sessionId,
      fleetId,
      tacticalMapId: this.tacticalMapId,
    });

    if (!fleet || !fleet.tacticalPosition) {
      return false;
    }

    fleet.isMoving = false;
    fleet.destination = undefined;
    fleet.tacticalPosition.velocity = { x: 0, y: 0 };

    await fleet.save();
    return true;
  }
}

// ============================================================================
// Combat Engine Manager (싱글톤 관리)
// ============================================================================

export class CombatEngineManager {
  private static engines: Map<string, RealtimeCombatEngine> = new Map();

  /**
   * 전투 엔진 가져오기 (없으면 생성)
   */
  static getEngine(sessionId: string, tacticalMapId: string): RealtimeCombatEngine {
    const key = `${sessionId}:${tacticalMapId}`;
    
    if (!this.engines.has(key)) {
      const engine = new RealtimeCombatEngine(sessionId, tacticalMapId);
      this.engines.set(key, engine);
    }
    
    return this.engines.get(key)!;
  }

  /**
   * 전투 엔진 제거
   */
  static removeEngine(sessionId: string, tacticalMapId: string): void {
    const key = `${sessionId}:${tacticalMapId}`;
    const engine = this.engines.get(key);
    
    if (engine) {
      engine.stop();
      this.engines.delete(key);
    }
  }

  /**
   * 모든 전투 엔진 정지
   */
  static stopAll(): void {
    for (const engine of this.engines.values()) {
      engine.stop();
    }
    this.engines.clear();
  }

  /**
   * 활성 전투 수
   */
  static getActiveCount(): number {
    return this.engines.size;
  }
}

// ============================================================================
// Static Factory Methods (기존 RealtimeCombatService 호환)
// ============================================================================

export class RealtimeCombatEngineService {
  /**
   * 전술 맵 생성 및 전투 시작
   */
  static async createTacticalMapAndStartBattle(
    sessionId: string,
    strategicX: number,
    strategicY: number,
    fleetIds: string[],
    onStateUpdate?: (state: BattleState) => void
  ): Promise<{ tacticalMap: ITacticalMap; engine: RealtimeCombatEngine }> {
    // 함대 정보 가져오기
    const fleets = await Fleet.find({
      session_id: sessionId,
      fleetId: { $in: fleetIds },
    });

    // 진영별 분류
    const empireFleets = fleets.filter((f) => f.faction === 'empire').map((f) => f.fleetId);
    const allianceFleets = fleets.filter((f) => f.faction === 'alliance').map((f) => f.fleetId);

    // 전술 맵 생성
    const tacticalMap = await TacticalMap.create({
      session_id: sessionId,
      tacticalMapId: uuidv4(),
      strategicGridPosition: { x: strategicX, y: strategicY },
      tacticalSize: {
        width: COMBAT_CONSTANTS.TACTICAL_MAP_SIZE,
        height: COMBAT_CONSTANTS.TACTICAL_MAP_SIZE,
      },
      status: 'active',
      participatingFleetIds: fleetIds,
      factions: { empire: empireFleets, alliance: allianceFleets },
      startTime: new Date(),
    });

    // 함대 배치
    await this.deployFleets(sessionId, tacticalMap, fleets);

    // 전투 엔진 시작
    const engine = CombatEngineManager.getEngine(sessionId, tacticalMap.tacticalMapId);
    engine.start(onStateUpdate);

    return { tacticalMap, engine };
  }

  /**
   * 함대를 전술 맵에 배치
   */
  private static async deployFleets(
    sessionId: string,
    tacticalMap: ITacticalMap,
    fleets: IFleet[]
  ): Promise<void> {
    const mapSize = COMBAT_CONSTANTS.TACTICAL_MAP_SIZE;

    for (const fleet of fleets) {
      let startX: number;
      let startY: number;

      if (fleet.faction === 'empire') {
        // 제국: 왼쪽에서 시작
        startX = mapSize * 0.1 + Math.random() * (mapSize * 0.2);
        startY = mapSize * 0.5 + (Math.random() - 0.5) * (mapSize * 0.4);
      } else if (fleet.faction === 'alliance') {
        // 동맹: 오른쪽에서 시작
        startX = mapSize * 0.7 + Math.random() * (mapSize * 0.2);
        startY = mapSize * 0.5 + (Math.random() - 0.5) * (mapSize * 0.4);
      } else {
        // 중립: 중앙
        startX = mapSize * 0.5;
        startY = mapSize * 0.5;
      }

      fleet.isInCombat = true;
      fleet.tacticalMapId = tacticalMap.tacticalMapId;
      fleet.tacticalPosition = {
        x: startX,
        y: startY,
        velocity: { x: 0, y: 0 },
        heading: fleet.faction === 'empire' ? 0 : 180,
      };
      fleet.status = 'combat';

      await fleet.save();
    }
  }

  /**
   * 함대 이동 명령 (전술 맵 내)
   */
  static async moveFleetTactical(
    sessionId: string,
    fleetId: string,
    targetX: number,
    targetY: number
  ): Promise<{ success: boolean; message: string }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
      isInCombat: true,
    });

    if (!fleet || !fleet.tacticalMapId) {
      return { success: false, message: '전투 중인 함대가 아닙니다.' };
    }

    const engine = CombatEngineManager.getEngine(sessionId, fleet.tacticalMapId);
    const success = await engine.moveFleet(fleetId, { x: targetX, y: targetY });

    return {
      success,
      message: success ? '이동 명령이 설정되었습니다.' : '이동 명령 실패',
    };
  }

  /**
   * 진형 변경 명령
   */
  static async changeFormation(
    sessionId: string,
    fleetId: string,
    formation: Formation
  ): Promise<{ success: boolean; message: string }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
      isInCombat: true,
    });

    if (!fleet || !fleet.tacticalMapId) {
      return { success: false, message: '전투 중인 함대가 아닙니다.' };
    }

    const engine = CombatEngineManager.getEngine(sessionId, fleet.tacticalMapId);
    const success = await engine.changeFormation(fleetId, formation);

    return {
      success,
      message: success ? `진형을 ${formation}으로 변경했습니다.` : '진형 변경 실패',
    };
  }

  /**
   * 후퇴 명령
   */
  static async retreatFleet(
    sessionId: string,
    fleetId: string
  ): Promise<{ success: boolean; message: string }> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
      isInCombat: true,
    });

    if (!fleet || !fleet.tacticalMapId) {
      return { success: false, message: '전투 중인 함대가 아닙니다.' };
    }

    const engine = CombatEngineManager.getEngine(sessionId, fleet.tacticalMapId);
    const success = await engine.retreat(fleetId);

    return {
      success,
      message: success ? '후퇴 명령이 설정되었습니다.' : '후퇴 명령 실패',
    };
  }
}




