/**
 * 파면 (Dismissal)
 * 직책에서 캐릭터 해임
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint } from '../../../utils/logh-rank-system';

export class DismissalCommand extends BaseLoghCommand {
  getName(): string {
    return 'dismissal';
  }

  getDisplayName(): string {
    return '파면';
  }

  getDescription(): string {
    return '직책에서 캐릭터 해임';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 20;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 추가 제약 조건 없음

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터에서 대상 커맨더 ID 가져오기
    const targetCommanderNo = env?.targetCommanderNo;
    if (!targetCommanderNo) {
      return {
        success: false,
        message: '파면할 대상을 지정해주세요.',
      };
    }

    // 대상 커맨더 조회
    const targetCommander = await LoghCommander.findOne({
      session_id: commander.session_id,
      no: targetCommanderNo,
    });

    if (!targetCommander) {
      return {
        success: false,
        message: '해당 커맨더를 찾을 수 없습니다.',
      };
    }

    // 같은 세력인지 확인
    if (targetCommander.faction !== commander.getFactionType()) {
      return {
        success: false,
        message: '다른 세력의 인원은 파면할 수 없습니다.',
      };
    }

    // 자신보다 계급이 높거나 같은 사람은 파면 불가
    if (!canAppoint(commander.getRank(), targetCommander.getRankName(), targetCommander.faction)) {
      return {
        success: false,
        message: '자신과 동등하거나 상급자는 파면할 수 없습니다.',
      };
    }

    // 직책이 없으면
    if (!targetCommander.jobPosition) {
      return {
        success: false,
        message: '해당 커맨더는 직책이 없습니다.',
      };
    }

    // 파면 실행
    const oldPosition = targetCommander.jobPosition;
    targetCommander.jobPosition = null;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}을(를) ${oldPosition}에서 파면했습니다.`,
      effects: [
        {
          type: 'position_change',
          commanderNo: targetCommanderNo,
          oldPosition,
          newPosition: null,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
