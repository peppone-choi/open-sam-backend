/**
 * 완전 수리 (完全修理, Complete Repair)
 * 손상 상태 기함 및 전 함정 유닛 수리. 부대 보유 군수물자 소비
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class CompleteRepairCommand extends BaseLoghCommand {
  getName(): string {
    return 'complete_repair';
  }

  getDisplayName(): string {
    return '완전 수리';
  }

  getDescription(): string {
    return '손상 상태 기함 및 전 함정 유닛 수리. 부대 보유 군수물자 소비';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 12; // 수리는 보급보다 오래 걸림
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
   * 수리 비용 계산
   */
  private calculateRepairCost(ships: any[]): number {
    let totalCost = 0;
    for (const ship of ships) {
      const damage = 100 - (ship.health || 100);
      if (damage > 0) {
        // 손상 1%당 군수물자 10 소비
        totalCost += Math.ceil((damage / 100) * ship.count * 10);
      }
    }
    return totalCost;
  }

  /**
   * 수리가 필요한지 체크
   */
  private needsRepair(ships: any[]): boolean {
    return ships.some(ship => (ship.health || 100) < 100);
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

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

    // 수리가 필요한지 확인
    if (!this.needsRepair(fleet.ships)) {
      return {
        success: false,
        message: '수리가 필요한 함선이 없습니다. 모든 함선이 완전한 상태입니다.',
      };
    }

    // 조병공창(Shipyard)이 있는 행성 근처인지 확인
    const planets = await Planet.find({
      session_id: commander.session_id,
      'gridCoordinates.x': fleet.strategicPosition.x,
      'gridCoordinates.y': fleet.strategicPosition.y,
      faction: fleet.faction,
    });

    if (planets.length === 0) {
      return {
        success: false,
        message: '수리 가능한 아군 행성(조병공창) 근처에 있지 않습니다.',
      };
    }

    // FUTURE: 행성에 조병공창 시설이 있는지 확인 (나중에 Facility 시스템 구현 후)
    
    // 수리 비용 계산
    const repairCost = this.calculateRepairCost(fleet.ships);

    if (fleet.supplies < repairCost) {
      return {
        success: false,
        message: `군수물자가 부족합니다. (필요: ${repairCost}, 보유: ${fleet.supplies})`,
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 군수물자 소비
    fleet.supplies -= repairCost;

    // 모든 함선 HP 100%로 회복
    let repairedShips = 0;
    for (const ship of fleet.ships) {
      if ((ship.health || 100) < 100) {
        ship.health = 100;
        repairedShips++;
      }
    }

    fleet.markModified('ships');
    await fleet.save();
    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('complete_repair', durationMs, { fleetId, repairCost, repairedShips });

    return {
      success: true,
      message: `완전 수리를 시작했습니다. ${planets[0].name}에서 ${repairedShips}종류 함선 수리 (군수물자 ${repairCost} 소비)`,
      effects: [
        {
          type: 'resource_change',
          resource: 'supplies',
          amount: -repairCost,
        },
        {
          type: 'ships_repaired',
          fleetId,
          repairedShips,
          location: planets[0].name,
        },
      ],
    };
  }
}
