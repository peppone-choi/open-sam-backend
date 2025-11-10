/**
 * 강의 (講義)
 * 수강 커맨드 실행 인물의 능력 파라미터 증가. 실행 후 120G분 또는 실행 스포트 이탈까지 유효. 사관학교에서만 실행 가능
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

export class LectureCommand extends BaseLoghCommand {
  getName(): string {
    return 'lecture';
  }

  getDisplayName(): string {
    return '강의';
  }

  getDescription(): string {
    return '수강 커맨드 실행 인물의 능력 파라미터 증가. 실행 후 120G분 또는 실행 스포트 이탈까지 유효. 사관학교에서만 실행 가능';
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
