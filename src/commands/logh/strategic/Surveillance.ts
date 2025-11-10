/**
 * 감시 (監視)
 * 동일 스포트 체류 특정 인물에게 감시 부착
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class SurveillanceCommand extends BaseLoghCommand {
  getName(): string {
    return 'surveillance';
  }

  getDisplayName(): string {
    return '감시';
  }

  getDescription(): string {
    return '동일 스포트 체류 특정 인물에게 감시 부착';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 160;
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
