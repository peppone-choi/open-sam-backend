/**
 * 회담 (会談)
 * 특정 인물을 자신이 체류하는 호텔 객실에 초대해 회담. 회담 성과에 따라 영향력 변화
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class ConferenceCommand extends BaseLoghCommand {
  getName(): string {
    return 'conference';
  }

  getDisplayName(): string {
    return '회담';
  }

  getDescription(): string {
    return '특정 인물을 자신이 체류하는 호텔 객실에 초대해 회담. 회담 성과에 따라 영향력 변화';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'diplomatic';
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
