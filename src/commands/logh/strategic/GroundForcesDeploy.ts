/**
 * 육전대 출격 (Ground Forces Deploy)
 * 행성/요새 전투에 대비해 전 육전대를 함정에서 주둔
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';

export class GroundForcesDeployCommand extends BaseLoghCommand {
  getName(): string {
    return 'ground_forces_deploy';
  }

  getDisplayName(): string {
    return '육전대 출격';
  }

  getDescription(): string {
    return '행성/요새 전투에 대비해 전 육전대를 함정에서 주둔';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // FUTURE: 커맨드별 구체적인 실행 로직 구현 (v2.0)
    // 현재는 기본 구현만 제공

    await commander.save();

    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
      effects: [
        {
          type: 'command_executed',
          commandType: this.getName(),
          cpCost: this.getRequiredCommandPoints(),
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
