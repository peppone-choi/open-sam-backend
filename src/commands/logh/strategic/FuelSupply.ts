/**
 * 연료 보급 (燃料補給, Fuel Supply)
 * 워프 연료의 보급 수행
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { Planet } from '../../../models/logh/Planet.model';

export class FuelSupplyCommand extends BaseLoghCommand {
  getName(): string {
    return 'fuel_supply';
  }

  getDisplayName(): string {
    return '연료 보급';
  }

  getDescription(): string {
    return '워프 연료의 보급 수행';
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
      // 함대 보유 필수
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
    ];
  }

  /**
   * 보급 가능 여부 체크 (행성이나 보급 시설에 정박 중이어야 함)
   */
  private async canSupply(fleet: any, sessionId: string): Promise<{ canSupply: boolean; reason?: string; planetName?: string }> {
    // 정박 중이거나 행성 근처에 있어야 함
    if (fleet.status !== 'docked' && !fleet.dockedPlanetId) {
      // 현재 그리드에 행성이 있는지 확인
      const planets = await Planet.find({
        session_id: sessionId,
        'gridCoordinates.x': fleet.strategicPosition.x,
        'gridCoordinates.y': fleet.strategicPosition.y,
        faction: fleet.faction, // 같은 진영 행성만
      });

      if (planets.length === 0) {
        return {
          canSupply: false,
          reason: '보급 가능한 행성 근처에 있지 않습니다. 아군 행성이나 보급 기지가 필요합니다.',
        };
      }

      return { canSupply: true, planetName: planets[0].name };
    }

    if (fleet.dockedPlanetId) {
      const planet = await Planet.findOne({
        session_id: sessionId,
        planetId: fleet.dockedPlanetId,
      });

      if (!planet) {
        return { canSupply: false, reason: '정박 중인 행성을 찾을 수 없습니다.' };
      }

      return { canSupply: true, planetName: planet.name };
    }

    return { canSupply: false, reason: '보급 가능한 위치가 아닙니다.' };
  }

  /**
   * 보급량 계산 (함선 수에 비례)
   */
  private calculateSupplyAmount(shipCount: number): number {
    // 함선 1척당 연료 10 보급
    return shipCount * 10;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 함대 조회
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

    // 보급 가능 여부 체크
    const supplyCheck = await this.canSupply(fleet, commander.session_id);
    if (!supplyCheck.canSupply) {
      return {
        success: false,
        message: supplyCheck.reason || '보급할 수 없습니다.',
      };
    }

    // 이미 연료가 최대치인지 확인
    const maxFuel = fleet.totalShips * 100; // 함선 1척당 최대 연료 100
    if (fleet.fuel >= maxFuel) {
      return {
        success: false,
        message: '연료가 이미 최대치입니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 보급량 계산
    const supplyAmount = this.calculateSupplyAmount(fleet.totalShips);
    const beforeFuel = fleet.fuel;
    fleet.fuel = Math.min(maxFuel, fleet.fuel + supplyAmount);
    const actualSupply = fleet.fuel - beforeFuel;

    await fleet.save();
    await commander.save();

    // 소요 시간 등록 (게임시간 8)
    const durationMs = 8 * 2500;
    commander.startCommand('fuel_supply', durationMs, { fleetId, supplyAmount: actualSupply });

    return {
      success: true,
      message: `연료 보급을 시작했습니다. ${supplyCheck.planetName || '행성'}에서 ${actualSupply} 연료 보급 (현재: ${beforeFuel} → ${fleet.fuel})`,
      effects: [
        {
          type: 'resource_change',
          resource: 'fuel',
          amount: actualSupply,
        },
        {
          type: 'supply_initiated',
          fleetId,
          location: supplyCheck.planetName,
          duration: 8,
        },
      ],
    };
  }
}
