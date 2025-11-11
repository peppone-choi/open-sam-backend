/**
 * LOGH Realtime Combat Service
 * 실시간 전투 처리 (턴제 아님)
 * 
 * 전략 그리드 1칸 = 전술 맵 10000x10000 좌표
 */

import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { TacticalMap, ITacticalMap } from '../../models/logh/TacticalMap.model';
import { v4 as uuidv4 } from 'uuid';

export class RealtimeCombatService {
  /**
   * 전술 맵 생성 (특정 전략 그리드 셀을 확대)
   */
  static async createTacticalMap(
    sessionId: string,
    strategicX: number,
    strategicY: number,
    fleetIds: string[]
  ): Promise<ITacticalMap> {
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
      strategicGridPosition: {
        x: strategicX,
        y: strategicY,
      },
      tacticalSize: {
        width: 10000,
        height: 10000,
      },
      status: 'active',
      participatingFleetIds: fleetIds,
      factions: {
        empire: empireFleets,
        alliance: allianceFleets,
      },
      startTime: new Date(),
    });

    // 함대들을 전술 맵 내 초기 위치에 배치
    await this.deployFleetsToTacticalMap(sessionId, tacticalMap, fleets);

    return tacticalMap;
  }

  /**
   * 함대를 전술 맵 내에 배치
   */
  private static async deployFleetsToTacticalMap(
    sessionId: string,
    tacticalMap: ITacticalMap,
    fleets: IFleet[]
  ): Promise<void> {
    const mapWidth = tacticalMap.tacticalSize.width;
    const mapHeight = tacticalMap.tacticalSize.height;

    for (const fleet of fleets) {
      // 진영별로 시작 위치 다르게 설정
      let startX: number;
      let startY: number;

      if (fleet.faction === 'empire') {
        // 제국: 왼쪽에서 시작
        startX = mapWidth * 0.1 + Math.random() * (mapWidth * 0.2);
        startY = mapHeight * 0.5 + (Math.random() - 0.5) * (mapHeight * 0.4);
      } else if (fleet.faction === 'alliance') {
        // 동맹: 오른쪽에서 시작
        startX = mapWidth * 0.7 + Math.random() * (mapWidth * 0.2);
        startY = mapHeight * 0.5 + (Math.random() - 0.5) * (mapHeight * 0.4);
      } else {
        // 중립: 중앙
        startX = mapWidth * 0.5;
        startY = mapHeight * 0.5;
      }

      fleet.isInCombat = true;
      fleet.tacticalMapId = tacticalMap.tacticalMapId;
      fleet.tacticalPosition = {
        x: startX,
        y: startY,
        velocity: { x: 0, y: 0 },
        heading: fleet.faction === 'empire' ? 0 : 180, // 제국은 오른쪽, 동맹은 왼쪽 보기
      };
      fleet.status = 'combat';

      await fleet.save();
    }
  }

  /**
   * 실시간 전투 업데이트 (매 틱마다 호출)
   * @param deltaTime 이전 틱으로부터 경과 시간 (초)
   */
  static async updateCombat(
    sessionId: string,
    tacticalMapId: string,
    deltaTime: number
  ): Promise<{
    fleetPositions: Array<{
      fleetId: string;
      x: number;
      y: number;
      heading: number;
    }>;
    combatEvents: Array<{
      type: 'shot' | 'hit' | 'destroy';
      sourceFleetId?: string;
      targetFleetId?: string;
      damage?: number;
    }>;
  }> {
    const fleets = await Fleet.find({
      session_id: sessionId,
      tacticalMapId,
      isInCombat: true,
    });

    const combatEvents: Array<any> = [];
    const fleetPositions: Array<any> = [];

    // 1. 함대 이동 처리
    for (const fleet of fleets) {
      if (fleet.tacticalPosition && fleet.isMoving) {
        // 속도 벡터에 따라 위치 업데이트
        const vx = fleet.tacticalPosition.velocity?.x || 0;
        const vy = fleet.tacticalPosition.velocity?.y || 0;

        // 진형 및 자세에 따른 기동력 보정
        const formationMods = this.getFormationModifiers(fleet.formation || 'standard');
        const stanceMods = this.getStanceModifiers(fleet.combatStance || 'balanced');
        const mobilityMultiplier = 1 + (formationMods.mobilityBonus + stanceMods.mobility) / 100;
        
        const effectiveSpeed = fleet.movementSpeed * mobilityMultiplier;

        fleet.tacticalPosition.x += vx * deltaTime * effectiveSpeed;
        fleet.tacticalPosition.y += vy * deltaTime * effectiveSpeed;

        // 목적지 도달 여부 확인
        if (fleet.destination) {
          const dx = fleet.destination.x - fleet.tacticalPosition.x;
          const dy = fleet.destination.y - fleet.tacticalPosition.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 10) {
            // 목적지 도달
            fleet.isMoving = false;
            fleet.destination = undefined;
            fleet.tacticalPosition.velocity = { x: 0, y: 0 };
          }
        }

        await fleet.save();
      }

      if (fleet.tacticalPosition) {
        fleetPositions.push({
          fleetId: fleet.fleetId,
          x: fleet.tacticalPosition.x,
          y: fleet.tacticalPosition.y,
          heading: fleet.tacticalPosition.heading || 0,
        });
      }
    }

    // 2. 전투 처리 (사정거리 내 적 공격)
    for (const attacker of fleets) {
      if (!attacker.tacticalPosition) continue;

      // 적 찾기
      const enemies = fleets.filter(
        (f) =>
          f.faction !== attacker.faction &&
          f.tacticalPosition &&
          f.totalShips > 0
      );

      for (const target of enemies) {
        if (!target.tacticalPosition) continue;

        // 거리 계산
        const dx = target.tacticalPosition.x - attacker.tacticalPosition.x;
        const dy = target.tacticalPosition.y - attacker.tacticalPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 사정거리에 자세 보정 적용
        const stanceModifiers = this.getStanceModifiers(attacker.combatStance || 'balanced');
        const effectiveRange = (attacker.combatRange || 100) * (1 + stanceModifiers.attackRange / 100);

        // 사정거리 내라면 공격
        if (distance <= effectiveRange) {
          const damage = this.calculateDamage(attacker, target, deltaTime);

          if (damage > 0) {
            target.totalShips = Math.max(0, target.totalShips - damage);
            target.totalStrength = Math.max(0, target.totalStrength - damage * 10);

            combatEvents.push({
              type: target.totalShips === 0 ? 'destroy' : 'hit',
              sourceFleetId: attacker.fleetId,
              targetFleetId: target.fleetId,
              damage,
            });

            await target.save();
          }
        }
      }
    }

    // 3. 공중전 처리 (전투기 임무)
    for (const fleet of fleets) {
      if (!fleet.customData?.airCombatActive || !fleet.tacticalPosition) continue;

      const airCombatResult = await this.processAirCombat(fleet, fleets, deltaTime);
      if (airCombatResult) {
        combatEvents.push(...airCombatResult.events);
      }
    }

    return {
      fleetPositions,
      combatEvents,
    };
  }

  /**
   * 공중전 처리 (전투기 임무)
   */
  private static async processAirCombat(
    attackerFleet: IFleet,
    allFleets: IFleet[],
    deltaTime: number
  ): Promise<{ events: Array<any> } | null> {
    const events: Array<any> = [];

    if (!attackerFleet.customData?.airCombatActive) {
      return null;
    }

    const missionType = attackerFleet.customData.airCombatMission;
    const airPower = attackerFleet.customData.airCombatPower || 0;
    const targetFleetId = attackerFleet.customData.airCombatTarget;

    if (!missionType || airPower <= 0) {
      return null;
    }

    // 목표 함대 찾기
    const targetFleet = allFleets.find(f => f.fleetId === targetFleetId);
    if (!targetFleet || !targetFleet.tacticalPosition) {
      // 목표 상실
      attackerFleet.customData.airCombatActive = false;
      await attackerFleet.save();
      return null;
    }

    // 거리 계산
    const dx = targetFleet.tacticalPosition.x - attackerFleet.tacticalPosition!.x;
    const dy = targetFleet.tacticalPosition.y - attackerFleet.tacticalPosition!.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 전투기 사정거리 (일반 함선보다 길다)
    const fighterRange = (attackerFleet.combatRange || 100) * 2;

    if (distance > fighterRange) {
      // 사정거리 밖
      return null;
    }

    // 임무 타입별 처리
    switch (missionType) {
      case 'attack': {
        // 대함 공격: 적 함선에 피해
        const baseDamage = airPower * 0.5 * deltaTime; // 전투기 1대당 0.5 피해/초
        const damage = Math.floor(baseDamage);

        if (damage > 0) {
          targetFleet.totalShips = Math.max(0, targetFleet.totalShips - damage);
          targetFleet.totalStrength = Math.max(0, targetFleet.totalStrength - damage * 10);

          events.push({
            type: 'air_attack',
            sourceFleetId: attackerFleet.fleetId,
            targetFleetId: targetFleet.fleetId,
            damage,
          });

          await targetFleet.save();
        }
        break;
      }

      case 'intercept': {
        // 요격: 적 전투기 격추
        if (targetFleet.customData?.airCombatActive && targetFleet.customData.airCombatPower) {
          const enemyAirPower = targetFleet.customData.airCombatPower;
          const interceptPower = airPower * 0.3 * deltaTime; // 초당 30% 격추율

          const destroyed = Math.min(enemyAirPower, Math.floor(interceptPower));
          if (destroyed > 0) {
            targetFleet.customData.airCombatPower -= destroyed;
            if (targetFleet.customData.airCombatPower <= 0) {
              targetFleet.customData.airCombatActive = false;
            }

            events.push({
              type: 'air_intercept',
              sourceFleetId: attackerFleet.fleetId,
              targetFleetId: targetFleet.fleetId,
              destroyed,
            });

            await targetFleet.save();
          }
        }
        break;
      }

      case 'escort': {
        // 호위: 아군 함대 방어력 증가 (보너스 적용은 피해 계산에서 처리)
        // 여기서는 로그만 남김
        events.push({
          type: 'air_escort',
          sourceFleetId: attackerFleet.fleetId,
          targetFleetId: targetFleet.fleetId,
        });
        break;
      }

      case 'recon': {
        // 정찰: 적 정보 수집 (시야 확장, 스탯 공개)
        // 실제 효과는 UI에서 처리
        events.push({
          type: 'air_recon',
          sourceFleetId: attackerFleet.fleetId,
          targetFleetId: targetFleet.fleetId,
        });
        break;
      }
    }

    return { events };
  }

  /**
   * 피해 계산 (실시간)
   */
  private static calculateDamage(
    attacker: IFleet,
    target: IFleet,
    deltaTime: number
  ): number {
    // 기본 공격력 = 전투력 / 100 (초당)
    let attackPower = attacker.totalStrength / 100;
    let defensePower = target.totalStrength / 200;

    // 진형 보정 적용
    const attackerFormation = this.getFormationModifiers(attacker.formation || 'standard');
    const targetFormation = this.getFormationModifiers(target.formation || 'standard');
    
    attackPower *= (1 + attackerFormation.attackBonus / 100);
    defensePower *= (1 + targetFormation.defenseBonus / 100);

    // 자세 보정 적용
    const attackerStance = this.getStanceModifiers(attacker.combatStance || 'balanced');
    const targetStance = this.getStanceModifiers(target.combatStance || 'balanced');
    
    // 명중률 보정 (자세에서)
    const hitChance = 0.8 + (attackerStance.accuracy / 100);
    // 회피율 보정
    const evadeChance = targetStance.evasion / 100;
    
    // 최종 명중 여부
    const finalHitChance = Math.max(0.1, Math.min(0.95, hitChance - evadeChance));
    
    // deltaTime 동안의 피해
    const baseDamage = (attackPower - defensePower) * deltaTime;
    
    // 사격 속도 보정
    const fireRateMultiplier = 1 + (attackerStance.fireRate / 100);

    // 최종 피해 = 기본피해 * 사격속도 * 명중확률
    const finalDamage = baseDamage * fireRateMultiplier * finalHitChance;

    return Math.max(0, Math.floor(finalDamage));
  }

  /**
   * 진형별 능력치 보정 (Formation.ts와 동기화)
   */
  private static getFormationModifiers(formation: string): {
    attackBonus: number;
    defenseBonus: number;
    mobilityBonus: number;
  } {
    const formationMap: Record<string, any> = {
      standard: { attackBonus: 0, defenseBonus: 0, mobilityBonus: 0 },
      offensive: { attackBonus: 20, defenseBonus: -10, mobilityBonus: 0 },
      defensive: { attackBonus: -10, defenseBonus: 20, mobilityBonus: -10 },
      encircle: { attackBonus: 10, defenseBonus: 0, mobilityBonus: -20 },
      retreat: { attackBonus: -50, defenseBonus: -20, mobilityBonus: 30 },
      wedge: { attackBonus: 30, defenseBonus: -15, mobilityBonus: 10 },
      crane: { attackBonus: 5, defenseBonus: -5, mobilityBonus: 5 },
    };

    return formationMap[formation] || formationMap.standard;
  }

  /**
   * 자세별 능력치 보정 (StanceChange.ts와 동기화)
   */
  private static getStanceModifiers(stance: string): {
    attackRange: number;
    fireRate: number;
    evasion: number;
    mobility: number;
    accuracy: number;
  } {
    const stanceMap: Record<string, any> = {
      balanced: { attackRange: 0, fireRate: 0, evasion: 0, mobility: 0, accuracy: 0 },
      aggressive: { attackRange: 10, fireRate: 20, evasion: -10, mobility: 15, accuracy: -5 },
      defensive: { attackRange: -10, fireRate: -10, evasion: 20, mobility: -20, accuracy: 10 },
      hold_fire: { attackRange: 0, fireRate: -100, evasion: 10, mobility: 20, accuracy: 0 },
      evasive: { attackRange: -20, fireRate: -30, evasion: 40, mobility: 50, accuracy: -20 },
    };

    return stanceMap[stance] || stanceMap.balanced;
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
    });

    if (!fleet || !fleet.tacticalPosition) {
      return {
        success: false,
        message: '전술 맵에 배치되지 않은 함대입니다.',
      };
    }

    // 목적지 설정
    fleet.destination = { x: targetX, y: targetY };
    fleet.isMoving = true;

    // 속도 벡터 계산
    const dx = targetX - fleet.tacticalPosition.x;
    const dy = targetY - fleet.tacticalPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      fleet.tacticalPosition.velocity = {
        x: dx / distance, // 정규화된 방향 벡터
        y: dy / distance,
      };

      // 진행 방향 업데이트
      fleet.tacticalPosition.heading = (Math.atan2(dy, dx) * 180) / Math.PI;
    }

    await fleet.save();

    return {
      success: true,
      message: '이동 명령이 설정되었습니다.',
    };
  }

  /**
   * 전투 종료
   */
  static async concludeCombat(
    sessionId: string,
    tacticalMapId: string
  ): Promise<void> {
    const tacticalMap = await TacticalMap.findOne({
      session_id: sessionId,
      tacticalMapId,
    });

    if (!tacticalMap) return;

    // 참여 함대들 상태 초기화
    const fleets = await Fleet.find({
      session_id: sessionId,
      tacticalMapId,
    });

    for (const fleet of fleets) {
      fleet.isInCombat = false;
      fleet.tacticalMapId = undefined;
      fleet.tacticalPosition = undefined;
      fleet.status = fleet.totalShips > 0 ? 'idle' : 'destroyed';
      await fleet.save();
    }

    // 전투 결과 계산
    const empireFleets = fleets.filter((f) => f.faction === 'empire');
    const allianceFleets = fleets.filter((f) => f.faction === 'alliance');

    const empireShipsRemaining = empireFleets.reduce((sum, f) => sum + f.totalShips, 0);
    const allianceShipsRemaining = allianceFleets.reduce((sum, f) => sum + f.totalShips, 0);

    let winner: 'empire' | 'alliance' | 'draw';
    if (empireShipsRemaining > 0 && allianceShipsRemaining === 0) {
      winner = 'empire';
    } else if (allianceShipsRemaining > 0 && empireShipsRemaining === 0) {
      winner = 'alliance';
    } else {
      winner = 'draw';
    }

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
  }

  /**
   * 특정 전략 그리드 위치에 활성 전투가 있는지 확인
   */
  static async getActiveCombatAtPosition(
    sessionId: string,
    strategicX: number,
    strategicY: number
  ): Promise<ITacticalMap | null> {
    return TacticalMap.findOne({
      session_id: sessionId,
      'strategicGridPosition.x': strategicX,
      'strategicGridPosition.y': strategicY,
      status: 'active',
    });
  }
}
