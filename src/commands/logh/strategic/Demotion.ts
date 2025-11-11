/**
 * 강등 (Demotion)
 * 캐릭터를 1계급 강등
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { demote, canAppoint } from '../../../utils/logh-rank-system';

export class DemotionCommand extends BaseLoghCommand {
  getName(): string {
    return 'demotion';
  }

  getDisplayName(): string {
    return '강등';
  }

  getDescription(): string {
    return '캐릭터를 1계급 강등';
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
        message: '강등시킬 대상을 지정해주세요.',
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
        message: '다른 세력의 인원은 강등시킬 수 없습니다.',
      };
    }

    // 자신보다 계급이 높거나 같은 사람은 강등 불가
    const targetRankName = targetCommander.getRankName();
    if (!canAppoint(commander.getRank(), targetRankName, targetCommander.faction)) {
      return {
        success: false,
        message: '자신과 동등하거나 상급자는 강등시킬 수 없습니다.',
      };
    }

    // 강등 실행
    const oldRank = targetRankName;
    const newRank = demote(targetRankName, targetCommander.faction);

    // 이미 최하위 계급이면
    if (oldRank === newRank) {
      return {
        success: false,
        message: '이미 최하위 계급입니다.',
      };
    }

    targetCommander.setRankByName(newRank);

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}을(를) ${oldRank}에서 ${newRank}으로 강등시켰습니다.`,
      effects: [
        {
          type: 'rank_change',
          commanderNo: targetCommanderNo,
          oldRank,
          newRank,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // TODO: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
