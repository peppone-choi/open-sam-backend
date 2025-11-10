/**
 * 수송 계획 (輸送計画)
 * 특정 행성/요새 대상 수송 패키지 작성. 작성 패키지는 수송 창고로 이동
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class TransportPlanCommand extends BaseLoghCommand {
  getName(): string {
    return 'transport_plan';
  }

  getDisplayName(): string {
    return '수송 계획';
  }

  getDescription(): string {
    return '특정 행성/요새 대상 수송 패키지 작성. 작성 패키지는 수송 창고로 이동';
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
