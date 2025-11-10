/**
 * 수렵 (狩猟)
 * 특정 인물을 자신의 봉토 행성 저택에 초대해 수렵. 수렵 결과에 따라 영향력과 초대객과의 우호도 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class HuntingCommand extends BaseLoghCommand {
  getName(): string {
    return 'hunting';
  }

  getDisplayName(): string {
    return '수렵';
  }

  getDescription(): string {
    return '특정 인물을 자신의 봉토 행성 저택에 초대해 수렵. 수렵 결과에 따라 영향력과 초대객과의 우호도 변화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 320;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: true,
      message: `${this.getDisplayName()}을(를) 실행했습니다.`,
      effects: [],
    };
  }
}
