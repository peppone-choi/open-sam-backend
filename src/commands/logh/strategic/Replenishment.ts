/**
 * 보충 (補充, Replenishment)
 * 전투로 손실된 함선 보충 (행성 창고에서 가져옴)
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class ReplenishmentCommand extends BaseLoghCommand {
  getName(): string {
    return 'replenishment';
  }

  getDisplayName(): string {
    return '보충';
  }

  getDescription(): string {
    return '전투로 손실된 함선 보충 (행성 창고에서 가져옴)';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 6; // 보충 작업 시간
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
    ];
  }

  /**
   * 보충 가능한 함선 수 계산
   */
  private calculateReplenishment(currentShips: any[], maxShipsPerType: number = 1000): any[] {
    const replenishments: any[] = [];
    
    for (const ship of currentShips) {
      const current = ship.count || 0;
      const max = maxShipsPerType; // FUTURE: 함선 종류별 최대 수량 (나중에 spec에서 가져오기)
      
      if (current < max) {
        replenishments.push({
          type: ship.type,
          current,
          needed: max - current,
        });
      }
    }
    
    return replenishments;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return {
        success: false,
        message: '함대를 보유하지 않았습니다.',
      };
    }

    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 정박 또는 행성 근처에 있어야 함
    const planets = await Planet.find({
      session_id: commander.session_id,
      'gridCoordinates.x': fleet.strategicPosition.x,
      'gridCoordinates.y': fleet.strategicPosition.y,
      faction: fleet.faction,
    });

    if (planets.length === 0) {
      return {
        success: false,
        message: '보충 가능한 아군 행성 근처에 있지 않습니다.',
      };
    }

    // 보충이 필요한 함선 계산
    const replenishments = this.calculateReplenishment(fleet.ships);

    if (replenishments.length === 0) {
      return {
        success: false,
        message: '보충이 필요한 함선이 없습니다. 모든 함대가 정원입니다.',
      };
    }

    // FUTURE: 행성 창고에서 함선 재고 확인 (Warehouse 시스템 구현 후)
    // 현재는 자동으로 보충 가능하다고 가정

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 함선 보충 실행
    let totalReplenished = 0;
    for (const replenishment of replenishments) {
      const shipIndex = fleet.ships.findIndex(s => s.type === replenishment.type);
      if (shipIndex >= 0) {
        const replenishAmount = Math.min(replenishment.needed, 100); // 한 번에 최대 100척
        fleet.ships[shipIndex].count += replenishAmount;
        totalReplenished += replenishAmount;
      }
    }

    // 총 함선 수 재계산
    fleet.totalShips = fleet.ships.reduce((sum, ship) => sum + ship.count, 0);

    fleet.markModified('ships');
    await fleet.save();
    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('replenishment', durationMs, { fleetId, totalReplenished });

    return {
      success: true,
      message: `${planets[0].name}에서 함선 보충을 시작했습니다. 총 ${totalReplenished}척 보충 예정`,
      effects: [
        {
          type: 'ships_replenished',
          fleetId,
          totalReplenished,
          location: planets[0].name,
        },
      ],
    };
  }
}
