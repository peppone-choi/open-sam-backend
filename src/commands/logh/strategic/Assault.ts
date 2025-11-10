/**
 * 습격 (襲撃)
 * 동일 스포트 체류 특정 인물에게 습격 시도. 대상은 타진영 인물에 한함
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class AssaultCommand extends BaseLoghCommand {
  getName(): string {
    return 'assault';
  }

  getDisplayName(): string {
    return '습격';
  }

  getDescription(): string {
    return '동일 스포트 체류 특정 인물에게 습격 시도. 대상은 타진영 인물에 한함';
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
