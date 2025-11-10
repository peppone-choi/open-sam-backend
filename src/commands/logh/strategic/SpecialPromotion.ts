/**
 * 발탁 (抜擢)
 * 각 계급 래더 최상위 외 인물을 임의로 1계급 승격
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class SpecialPromotionCommand extends BaseLoghCommand {
  getName(): string {
    return 'special_promotion';
  }

  getDisplayName(): string {
    return '발탁';
  }

  getDescription(): string {
    return '각 계급 래더 최상위 외 인물을 임의로 1계급 승격';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 640;
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
