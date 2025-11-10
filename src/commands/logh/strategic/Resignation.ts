/**
 * 사임 (辞任)
 * 해당 직무 권한 포기
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class ResignationCommand extends BaseLoghCommand {
  getName(): string {
    return 'resignation';
  }

  getDisplayName(): string {
    return '사임';
  }

  getDescription(): string {
    return '해당 직무 권한 포기';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
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
