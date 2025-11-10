/**
 * 연설 (演説)
 * 행성/요새 중앙광장에서 연설. 연설 성과에 따라 영향력과 해당 행성/요새 정부 지지율 증감
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class SpeechCommand extends BaseLoghCommand {
  getName(): string {
    return 'speech';
  }

  getDisplayName(): string {
    return '연설';
  }

  getDescription(): string {
    return '행성/요새 중앙광장에서 연설. 연설 성과에 따라 영향력과 해당 행성/요새 정부 지지율 증감';
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
