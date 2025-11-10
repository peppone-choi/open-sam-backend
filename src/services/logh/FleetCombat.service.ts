/**
 * LOGH Fleet Combat Service
 * 100x50 그리드 맵에서 직접 전투 처리
 */

import { Fleet, IFleet } from '../../models/logh/Fleet.model';
import { MapGrid } from '../../models/logh/MapGrid.model';

export class FleetCombatService {
  /**
   * 두 함대 간 거리 계산 (맨해튼 거리)
   */
  static calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * 유클리드 거리 계산
   */
  static calculateEuclideanDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 특정 범위 내의 적 함대 찾기
   */
  static async findEnemyFleetsInRange(
    sessionId: string,
    fleet: IFleet,
    range: number
  ): Promise<IFleet[]> {
    const allFleets = await Fleet.find({
      session_id: sessionId,
      faction: { $ne: fleet.faction }, // 적 진영
      status: { $ne: 'docked' }, // 정박 중이 아님
    });

    return allFleets.filter((enemyFleet) => {
      const distance = this.calculateDistance(
        fleet.gridPosition,
        enemyFleet.gridPosition
      );
      return distance <= range;
    });
  }

  /**
   * 전투 시작
   */
  static async startCombat(
    sessionId: string,
    attackerFleetId: string,
    defenderFleetId: string
  ): Promise<{
    success: boolean;
    message: string;
    combat?: {
      attacker: IFleet;
      defender: IFleet;
      distance: number;
    };
  }> {
    const attacker = await Fleet.findOne({
      session_id: sessionId,
      fleetId: attackerFleetId,
    });

    const defender = await Fleet.findOne({
      session_id: sessionId,
      fleetId: defenderFleetId,
    });

    if (!attacker || !defender) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 같은 진영 체크
    if (attacker.faction === defender.faction) {
      return {
        success: false,
        message: '같은 진영의 함대는 공격할 수 없습니다.',
      };
    }

    // 거리 체크
    const distance = this.calculateDistance(
      attacker.gridPosition,
      defender.gridPosition
    );

    if (distance > (attacker.combatRange || 2)) {
      return {
        success: false,
        message: `사정거리를 벗어났습니다. (거리: ${distance}, 사정거리: ${attacker.combatRange})`,
      };
    }

    // 전투 상태로 변경
    attacker.isInCombat = true;
    attacker.combatTarget = defender.fleetId;
    attacker.status = 'combat';
    await attacker.save();

    defender.isInCombat = true;
    defender.combatTarget = attacker.fleetId;
    defender.status = 'combat';
    await defender.save();

    return {
      success: true,
      message: '전투가 시작되었습니다.',
      combat: {
        attacker,
        defender,
        distance,
      },
    };
  }

  /**
   * 전투 라운드 실행 (간단한 버전)
   */
  static async executeCombatRound(
    sessionId: string,
    fleet1Id: string,
    fleet2Id: string
  ): Promise<{
    success: boolean;
    result: {
      fleet1Damage: number;
      fleet2Damage: number;
      fleet1Remaining: number;
      fleet2Remaining: number;
      winner?: string;
    };
  }> {
    const fleet1 = await Fleet.findOne({
      session_id: sessionId,
      fleetId: fleet1Id,
    });

    const fleet2 = await Fleet.findOne({
      session_id: sessionId,
      fleetId: fleet2Id,
    });

    if (!fleet1 || !fleet2) {
      return {
        success: false,
        result: {
          fleet1Damage: 0,
          fleet2Damage: 0,
          fleet1Remaining: 0,
          fleet2Remaining: 0,
        },
      };
    }

    // 간단한 전투 계산 (전투력 기반)
    const fleet1Power = fleet1.totalStrength * (fleet1.morale / 100);
    const fleet2Power = fleet2.totalStrength * (fleet2.morale / 100);

    // 진형 보너스
    const fleet1FormationBonus = this.getFormationBonus(fleet1.formation);
    const fleet2FormationBonus = this.getFormationBonus(fleet2.formation);

    const adjustedPower1 = fleet1Power * fleet1FormationBonus;
    const adjustedPower2 = fleet2Power * fleet2FormationBonus;

    // 피해 계산 (상대 전투력에 비례)
    const damageRate = 0.1; // 10% 피해
    const fleet1Damage = Math.floor(adjustedPower2 * damageRate);
    const fleet2Damage = Math.floor(adjustedPower1 * damageRate);

    // 함선 손실 적용
    fleet1.totalShips = Math.max(0, fleet1.totalShips - fleet1Damage);
    fleet1.totalStrength = Math.max(0, fleet1.totalStrength - fleet1Damage * 10);
    fleet2.totalShips = Math.max(0, fleet2.totalShips - fleet2Damage);
    fleet2.totalStrength = Math.max(0, fleet2.totalStrength - fleet2Damage * 10);

    // 승자 판정
    let winner: string | undefined;
    if (fleet1.totalShips === 0) {
      winner = fleet2.fleetId;
      fleet1.status = 'retreating';
    } else if (fleet2.totalShips === 0) {
      winner = fleet1.fleetId;
      fleet2.status = 'retreating';
    }

    await fleet1.save();
    await fleet2.save();

    return {
      success: true,
      result: {
        fleet1Damage,
        fleet2Damage,
        fleet1Remaining: fleet1.totalShips,
        fleet2Remaining: fleet2.totalShips,
        winner,
      },
    };
  }

  /**
   * 진형 보너스 계산
   */
  private static getFormationBonus(formation: string): number {
    switch (formation) {
      case 'offensive':
        return 1.2; // 공격 +20%
      case 'defensive':
        return 0.8; // 방어 중시 (피해 감소)
      case 'encircle':
        return 1.1; // 포위 +10%
      case 'retreat':
        return 0.5; // 후퇴 중
      default:
        return 1.0; // 표준
    }
  }

  /**
   * 전투 종료
   */
  static async endCombat(sessionId: string, fleetId: string): Promise<void> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (fleet) {
      fleet.isInCombat = false;
      fleet.combatTarget = undefined;
      fleet.status = 'idle';
      await fleet.save();
    }
  }

  /**
   * 특정 그리드 셀의 모든 함대 조회
   */
  static async getFleetsAtPosition(
    sessionId: string,
    x: number,
    y: number
  ): Promise<IFleet[]> {
    return Fleet.find({
      session_id: sessionId,
      'gridPosition.x': x,
      'gridPosition.y': y,
    });
  }

  /**
   * 전투 가능 여부 체크 (자동 전투 발생 조건)
   */
  static async checkForAutoCombat(
    sessionId: string,
    x: number,
    y: number
  ): Promise<{
    hasCombat: boolean;
    fleets?: IFleet[];
  }> {
    const fleets = await this.getFleetsAtPosition(sessionId, x, y);

    if (fleets.length < 2) {
      return { hasCombat: false };
    }

    // 다른 진영이 있는지 확인
    const factions = new Set(fleets.map((f) => f.faction));
    const hasCombat = factions.size > 1;

    return {
      hasCombat,
      fleets: hasCombat ? fleets : undefined,
    };
  }
}
