/**
 * 통치 목표 (統治目標)
 * 특정 행성/요새에 대해 전략적 목표 제시
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class GovernanceGoalCommand extends BaseLoghCommand {
  getName(): string {
    return 'governance_goal';
  }

  getDisplayName(): string {
    return '통치 목표';
  }

  getDescription(): string {
    return '특정 행성/요새에 대해 전략적 목표 제시';
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
