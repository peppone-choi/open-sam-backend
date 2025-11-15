/**
 * 승진 (Promotion)
 * 캐릭터를 1계급 승진
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { LoghCommander } from '../../../models/logh/Commander.model';
import { canPromote, promote } from '../../../utils/logh-rank-system';

export class PromotionCommand extends BaseLoghCommand {
  getName(): string {
    return 'promotion';
  }

  getDisplayName(): string {
    return '승진';
  }

  getDescription(): string {
    return '캐릭터를 1계급 승진';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'admin';
  }

  getRequiredCommandPoints(): number {
    return 30;
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
        message: '승진시킬 대상을 지정해주세요.',
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
        message: '다른 세력의 인원은 승진시킬 수 없습니다.',
      };
    }

    // 승진 가능 여부 확인
    const currentRankName = targetCommander.getRankName();
    if (!canPromote(currentRankName, targetCommander.achievements!, targetCommander.faction)) {
      return {
        success: false,
        message: `공적이 부족하여 승진할 수 없습니다. (현재 공적: ${targetCommander.achievements})`,
      };
    }

    // 승진 실행
    const oldRank = currentRankName;
    const newRank = promote(currentRankName, targetCommander.faction);

    targetCommander.setRankByName(newRank);

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await targetCommander.save();
    await commander.save();

    return {
      success: true,
      message: `${targetCommander.name}을(를) ${oldRank}에서 ${newRank}으로 승진시켰습니다.`,
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
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우, v2.0)
  }
}
