/**
 * 체포 명령 (逮捕命令)
 * 동일 스포트 또는 동일 공간 그리드 동일 부대 내 특정 인물 체포 시도
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class ArrestOrderCommand extends BaseLoghCommand {
  getName(): string {
    return 'arrest_order';
  }

  getDisplayName(): string {
    return '체포 명령';
  }

  getDescription(): string {
    return '동일 스포트 또는 동일 공간 그리드 동일 부대 내 특정 인물 체포 시도';
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
