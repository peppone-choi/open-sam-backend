/**
 * 야회 (夜会)
 * 특정 인물을 자신의 수도 저택에 초대해 야회. 야회 성과에 따라 영향력 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class SoireeCommand extends BaseLoghCommand {
  getName(): string {
    return 'soiree';
  }

  getDisplayName(): string {
    return '야회';
  }

  getDescription(): string {
    return '특정 인물을 자신의 수도 저택에 초대해 야회. 야회 성과에 따라 영향력 변화';
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
    return 'PCP';
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
