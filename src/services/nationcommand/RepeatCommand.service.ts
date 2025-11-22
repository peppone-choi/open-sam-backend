import { generalRepository } from '../../repositories/general.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import GameConstants from '../../utils/game-constants';

const MAX_CHIEF_TURN = GameConstants.MAX_CHIEF_TURN;

export class RepeatCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);
    
    try {
      if (isNaN(amount)) {
        throw new Error('amount가 숫자가 아닙니다.');
      }

      if (amount < 1 || amount > 12) {
        throw new Error('범위를 벗어났습니다 (1 ~ 12)');
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        throw new Error('올바르지 않은 장수입니다.');
      }

      const generalData = general.data;
      const nationId = generalData.nation;
      const officerLevel = generalData.officer_level || 1;

      if (!nationId) {
        throw new Error('국가에 소속되어 있지 않습니다.');
      }

      if (officerLevel < 5) {
        throw new Error('수뇌가 아닙니다.');
      }

      await this.repeatNationCommand(sessionId, nationId, officerLevel, amount);

      return {
        success: true,
        result: true,
        message: '국가 명령이 반복 배치되었습니다.'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static async repeatNationCommand(
    sessionId: string,
    nationId: number,
    officerLevel: number,
    turnCnt: number
  ) {
    if (turnCnt <= 0 || turnCnt >= MAX_CHIEF_TURN) {
      return;
    }

    let reqTurn = turnCnt;
    if (turnCnt * 2 > MAX_CHIEF_TURN) {
      reqTurn = MAX_CHIEF_TURN - turnCnt;
    }

    const turnList = await nationTurnRepository.findByFilter({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.officer_level': officerLevel,
      'data.turn_idx': { $lt: reqTurn }
    });

    if (!turnList || turnList.length === 0) {
      return;
    }

    for (const turn of turnList) {
      const turnIdx = turn.turn_idx;
      const action = turn.action;
      const arg = turn.arg;
      const brief = turn.brief;

      const targetIndices: number[] = [];
      for (let i = turnIdx + turnCnt; i < MAX_CHIEF_TURN; i += turnCnt) {
        targetIndices.push(i);
      }

      await nationTurnRepository.updateMany(
        {
          session_id: sessionId,
          'data.nation_id': nationId,
          'data.officer_level': officerLevel,
          'data.turn_idx': { $in: targetIndices }
        },
        {
          $set: {
            'data.action': action,
            'data.arg': arg,
            'data.brief': brief
          }
        }
      );
    }
  }
}
