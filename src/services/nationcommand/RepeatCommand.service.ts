import { General } from '../../models/general.model';
import { NationTurn } from '../../models/nation_turn.model';
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

      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

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
        message: 'RepeatCommand executed successfully'
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

    const turnList = await NationTurn.find({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.officer_level': officerLevel,
      'data.turn_idx': { $lt: reqTurn }
    });

    if (!turnList || turnList.length === 0) {
      return;
    }

    for (const turn of turnList) {
      const turnIdx = turn.data.turn_idx;
      const action = turn.data.action;
      const arg = turn.data.arg;
      const brief = turn.data.brief;

      const targetIndices: number[] = [];
      for (let i = turnIdx + turnCnt; i < MAX_CHIEF_TURN; i += turnCnt) {
        targetIndices.push(i);
      }

      await NationTurn.updateMany(
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
