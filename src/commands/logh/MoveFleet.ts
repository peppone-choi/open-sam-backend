/**
 * MoveFleet - 함대 이동 커맨드
 *
 * 커맨더가 지휘하는 함대를 목표 좌표로 워프 항행시킵니다.
 */

import { BaseLoghCommand, ILoghCommandContext } from './BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../constraints/ConstraintHelper';

export class MoveFleetCommand extends BaseLoghCommand {
  getName(): string {
    return 'move_fleet';
  }

  getDisplayName(): string {
    return '함대 이동';
  }

  getDescription(): string {
    return '함대를 지정한 좌표로 워프 항행시킵니다. 거리에 따라 소요 턴과 보급품이 소모됩니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 2; // 이동은 기본 2 CP
  }

  getRequiredTurns(): number {
    return 1; // 기본 1턴, 거리에 따라 증가
  }

  getConstraints(): IConstraint[] {
    return [
      // 함대 보유 필수
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
      // 보급품 체크는 execute에서 동적 계산
    ];
  }

  /**
   * 워프 거리 계산 (3D 유클리드 거리)
   */
  private calculateDistance(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 워프에 필요한 턴 수 계산
   */
  private calculateWarpTurns(distance: number): number {
    // gin7manual.txt: 거리 100당 1턴
    return Math.max(1, Math.ceil(distance / 100));
  }

  /**
   * 워프에 필요한 보급품 계산
   */
  private calculateWarpCost(distance: number, shipCount: number): number {
    // 함선 1척당 거리 1당 보급품 0.1 소모
    return Math.ceil(distance * shipCount * 0.1);
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, fleet, env } = context;

    // 목표 좌표 가져오기 (커맨드 인자로 전달됨)
    const targetX = env.targetX || 0;
    const targetY = env.targetY || 0;
    const targetZ = env.targetZ || 0;

    const currentPos = commander.getPosition();
    const targetPos = { x: targetX, y: targetY, z: targetZ };

    // 거리 계산
    const distance = this.calculateDistance(currentPos, targetPos);

    if (distance < 1) {
      return {
        success: false,
        message: '이동 거리가 너무 짧습니다.',
      };
    }

    // 워프 비용 계산
    const shipCount = fleet?.ships || 1000;
    const warpCost = this.calculateWarpCost(distance, shipCount);
    const warpTurns = this.calculateWarpTurns(distance);

    // 보급품 체크
    const currentSupplies = commander.getVar('supplies') || 0;
    if (currentSupplies < warpCost) {
      return {
        success: false,
        message: `보급품이 부족합니다. (필요: ${warpCost}, 보유: ${currentSupplies})`,
      };
    }

    // 워프 실행
    commander.decreaseVar('supplies', warpCost);
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 함대 위치 업데이트 (턴 처리 시 실제 반영)
    commander.setVar('target_position', targetPos);
    commander.setVar('warp_turns_remaining', warpTurns);

    await commander.save();

    return {
      success: true,
      message: `함대가 워프 항행을 시작했습니다. 도착까지 ${warpTurns}턴 소요됩니다.`,
      effects: [
        {
          type: 'resource_change',
          resource: 'supplies',
          amount: -warpCost,
        },
        {
          type: 'fleet_movement',
          from: currentPos,
          to: targetPos,
          turns: warpTurns,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    const { commander } = context;

    const turnsRemaining = commander.getVar('warp_turns_remaining') || 0;

    if (turnsRemaining > 0) {
      commander.setVar('warp_turns_remaining', turnsRemaining - 1);

      if (turnsRemaining === 1) {
        // 도착!
        const targetPos = commander.getVar('target_position');
        if (targetPos) {
          commander.setVar('position_x', targetPos.x);
          commander.setVar('position_y', targetPos.y);
          commander.setVar('position_z', targetPos.z);
          commander.setVar('target_position', null);
          commander.setVar('warp_turns_remaining', 0);

          // 도착
        }
      }

      await commander.save();
    }
  }
}
