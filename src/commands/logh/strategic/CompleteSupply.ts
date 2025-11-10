/**
 * 완전 보급 (完全補給, Complete Supply)
 * 부대에 군수물자를 완전 보급
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class CompleteSupplyCommand extends BaseLoghCommand {
  getName(): string {
    return 'complete_supply';
  }

  getDisplayName(): string {
    return '완전 보급';
  }

  getDescription(): string {
    return '부대에 군수물자를 완전 보급';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 160;
  }

  getRequiredTurns(): number {
    return 8; // 실행 대기 시간
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
   * 보급량 계산
   */
  private calculateSupplyAmount(shipCount: number): number {
    // 함선 1척당 군수물자 100 보급
    return shipCount * 100;
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

    // 행성 근처에 있는지 확인
    const planets = await Planet.find({
      session_id: commander.session_id,
      'gridCoordinates.x': fleet.strategicPosition.x,
      'gridCoordinates.y': fleet.strategicPosition.y,
      faction: fleet.faction,
    });

    if (planets.length === 0) {
      return {
        success: false,
        message: '보급 가능한 아군 행성 근처에 있지 않습니다.',
      };
    }

    // 최대 보급량
    const maxSupplies = fleet.totalShips * 1000;
    if (fleet.supplies >= maxSupplies) {
      return {
        success: false,
        message: '군수물자가 이미 최대치입니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 보급 실행
    const supplyAmount = this.calculateSupplyAmount(fleet.totalShips);
    const beforeSupplies = fleet.supplies;
    fleet.supplies = Math.min(maxSupplies, fleet.supplies + supplyAmount);
    const actualSupply = fleet.supplies - beforeSupplies;

    await fleet.save();
    await commander.save();

    // 소요 시간 등록
    const durationMs = this.getRequiredTurns() * 2500;
    commander.startCommand('complete_supply', durationMs, { fleetId, supplyAmount: actualSupply });

    return {
      success: true,
      message: `완전 보급을 시작했습니다. ${planets[0].name}에서 ${actualSupply} 군수물자 보급 (${beforeSupplies} → ${fleet.supplies})`,
      effects: [
        {
          type: 'resource_change',
          resource: 'supplies',
          amount: actualSupply,
        },
        {
          type: 'supply_completed',
          fleetId,
          location: planets[0].name,
        },
      ],
    };
  }
}
