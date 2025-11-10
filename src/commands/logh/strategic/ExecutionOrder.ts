/**
 * 집행 명령 (執行命令)
 * 특정 인물에게 체포 리스트 등록 인물 중 하나를 체포할 권한 부여
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class ExecutionOrderCommand extends BaseLoghCommand {
  getName(): string {
    return 'execution_order';
  }

  getDisplayName(): string {
    return '집행 명령';
  }

  getDescription(): string {
    return '특정 인물에게 체포 리스트 등록 인물 중 하나를 체포할 권한 부여';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 800;
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
