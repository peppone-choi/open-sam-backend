/**
 * 임명 (Appointment)
 * 직책에 캐릭터 임명
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canAppoint } from '../../../utils/logh-rank-system';

export class AppointmentCommand extends BaseLoghCommand {
  getName(): string {
    return 'appointment';
  }

  getDisplayName(): string {
    return '임명';
  }

  getDescription(): string {
    return '직책에 캐릭터 임명';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 25;
  }

  getRequiredTurns(): number {
    return 0;
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'PCP';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    // 제약 조건: 임명 가능 계급 범위 내여야 함. 자신과 동등/이상 계급은 임명 불가
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          // 구체적인 제약 조건은 execute에서 확인
          return true;
        },
        '임명 가능 계급 범위 내여야 함. 자신과 동등/이상 계급은 임명 불가'
      )
    );

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 파라미터에서 대상 커맨더 ID와 직책 가져오기
    const targetCommanderNo = env?.targetCommanderNo;
    const position = env?.position;

    if (!targetCommanderNo) {
      return {
        success: false,
        message: '임명할 대상을 지정해주세요.',
      };
    }

    if (!position) {
      return {
        success: false,
        message: '임명할 직책을 지정해주세요.',
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
        message: '다른 세력의 인원은 임명할 수 없습니다.',
      };
    }

    // 자신보다 계급이 높거나 같은 사람은 임명 불가
    if (!canAppoint(commander.getRank(), targetCommander.getRankName(), targetCommander.faction)) {
      return {
        success: false,
        message: '자신과 동등하거나 상급자는 임명할 수 없습니다.',
      };
    }

    // 이미 해당 직책에 있는 사람이 있는지 확인
    const existingHolder = await LoghCommander.findOne({
      session_id: commander.session_id,
      faction: commander.getFactionType(),
      jobPosition: position,
    });

    if (existingHolder && existingHolder.no !== targetCommanderNo) {
      return {
        success: false,
        message: `해당 직책은 이미 ${existingHolder.name}이(가) 맡고 있습니다. 먼저 파면해주세요.`,
      };
    }

    // 임명 실행
    const oldPosition = targetCommander.jobPosition;
    targetCommander.jobPosition = position;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}을(를) ${position}에 임명했습니다.`,
      effects: [
        {
          type: 'position_change',
          commanderNo: targetCommanderNo,
          oldPosition,
          newPosition: position,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
