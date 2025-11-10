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

        fleet.tacticalPosition.x += vx * deltaTime * fleet.movementSpeed;
        fleet.tacticalPosition.y += vy * deltaTime * fleet.movementSpeed;

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

        // 사정거리 내라면 공격
        if (distance <= (attacker.combatRange || 100)) {
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

    return {
      fleetPositions,
      combatEvents,
    };
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
    const attackPower = attacker.totalStrength / 100;
    const defensePower = target.totalStrength / 200;

    // deltaTime 동안의 피해
    const baseDamage = (attackPower - defensePower) * deltaTime;

    // 진형 보너스
    const formationBonus = this.getFormationBonus(attacker.formation);

    return Math.max(0, Math.floor(baseDamage * formationBonus));
  }

  /**
   * 진형 보너스
   */
  private static getFormationBonus(formation: string): number {
    switch (formation) {
      case 'offensive':
        return 1.5;
      case 'defensive':
        return 0.8;
      case 'encircle':
        return 1.2;
      case 'retreat':
        return 0.5;
      default:
        return 1.0;
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
