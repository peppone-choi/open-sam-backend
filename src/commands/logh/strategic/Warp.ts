/**
 * 워프 항행 (워프 항해)
 * 임의의 그리드로 이동. 이동 거리에 따라 소비 CP 및 실행 대기 시간 변화. 우주공간에서만 실행 가능
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';
import { MapGrid } from '../../../models/logh/MapGrid.model';

export class WarpCommand extends BaseLoghCommand {
  getName(): string {
    return 'warp';
  }

  getDisplayName(): string {
    return '워프 항행';
  }

  getDescription(): string {
    return '임의의 그리드로 이동. 이동 거리에 따라 소비 CP 및 실행 대기 시간 변화. 우주공간에서만 실행 가능';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 40;
  }

  getRequiredTurns(): number {
    return 0; // 거리에 따라 동적으로 계산
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
   * 거리 계산 (유클리드 거리)
   */
  private calculateDistance(from: { x: number; y: number }, to: { x: number; y: number }): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 워프에 필요한 연료 계산
   * gin7manual: 거리에 비례, 항속 100 이상 필요
   */
  private calculateFuelCost(distance: number, shipCount: number): number {
    // 함선 1척당 거리 1당 연료 0.1 소모
    return Math.ceil(distance * shipCount * 0.1);
  }

  /**
   * 워프 소요 시간 계산 (게임시간)
   * 거리에 비례, 장거리는 오래 걸림
   */
  private calculateWarpDuration(distance: number): number {
    // 거리 10당 1 게임시간 (실시간 2.5초)
    return Math.ceil(distance / 10);
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 목표 좌표
    const targetX = env.targetX;
    const targetY = env.targetY;

    if (typeof targetX !== 'number' || typeof targetY !== 'number') {
      return {
        success: false,
        message: '목표 좌표를 지정해야 합니다.',
      };
    }

    if (targetX < 0 || targetX > 99 || targetY < 0 || targetY > 49) {
      return {
        success: false,
        message: '유효한 좌표 범위를 벗어났습니다. (X: 0-99, Y: 0-49)',
      };
    }

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

    // 현재 위치
    const currentPos = fleet.strategicPosition;

    // 거리 계산
    const distance = this.calculateDistance(currentPos, { x: targetX, y: targetY });

    if (distance < 1) {
      return {
        success: false,
        message: '이미 목표 위치에 있습니다.',
      };
    }

    // 목표 그리드가 항행 가능한지 체크
    const mapGrid = await MapGrid.findOne({ session_id: commander.session_id });
    if (!mapGrid) {
      return {
        success: false,
        message: '맵 데이터를 찾을 수 없습니다.',
      };
    }

    const targetCell = mapGrid.grid[targetY]?.[targetX];
    if (targetCell === undefined || targetCell === 0) {
      return {
        success: false,
        message: '항행 불가능한 지역입니다 (장애물, 성운 등).',
      };
    }

    // 연료 소모 계산
    const fuelCost = this.calculateFuelCost(distance, fleet.totalShips);

    if (fleet.fuel < fuelCost) {
      return {
        success: false,
        message: `연료가 부족합니다. (필요: ${fuelCost}, 보유: ${fleet.fuel})`,
      };
    }

    if (fleet.fuel < 100) {
      return {
        success: false,
        message: '항속이 100 미만입니다. 워프 항행을 할 수 없습니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 연료 소모
    fleet.fuel -= fuelCost;

    // 워프 시작 (RealtimeMovementService가 처리)
    fleet.destination = { x: targetX, y: targetY };
    fleet.isMoving = true;
    fleet.status = 'moving';

    await fleet.save();
    await commander.save();

    // 소요 시간 계산 (타이머 등록)
    const warpDuration = this.calculateWarpDuration(distance);
    const durationMs = warpDuration * 2500; // 게임시간 → 밀리초
    commander.startCommand('warp', durationMs, { targetX, targetY, fleetId });

    return {
      success: true,
      message: `워프 항행을 시작했습니다. 목표: (${targetX}, ${targetY}), 거리: ${distance.toFixed(1)}, 소요 시간: ${warpDuration} 게임시간`,
      effects: [
        {
          type: 'resource_change',
          resource: 'fuel',
          amount: -fuelCost,
        },
        {
          type: 'fleet_movement',
          fleetId,
          from: currentPos,
          to: { x: targetX, y: targetY },
          distance,
          duration: warpDuration,
        },
      ],
    };
  }
}
