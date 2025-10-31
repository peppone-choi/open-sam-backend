import { GeneralTurn } from '../../models/general_turn.model';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

const MAX_TURN = 30;

export class GetReservedCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    if (!generalId) {
      return {
        success: false,
        message: '장수 ID가 필요합니다'
      };
    }

    const rawTurns = await GeneralTurn.find({
      session_id: sessionId,
      'data.general_id': generalId
    }).sort({ 'data.turn_idx': 1 });

    const commandList: any = {};
    let invalidTurnList = 0;

    for (const turn of rawTurns) {
      let turnIdx = turn.data.turn_idx;
      const action = turn.data.action;
      const arg = turn.data.arg;
      const brief = turn.data.brief;

      if (turnIdx < 0) {
        invalidTurnList = -1;
        turnIdx += MAX_TURN;
      } else if (turnIdx >= MAX_TURN) {
        invalidTurnList = 1;
        turnIdx -= MAX_TURN;
      }

      commandList[turnIdx] = {
        action,
        brief,
        arg: typeof arg === 'string' ? JSON.parse(arg) : arg
      };
    }

    if (invalidTurnList > 0) {
      await GeneralTurn.updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $gte: MAX_TURN }
        },
        {
          $inc: { 'data.turn_idx': -MAX_TURN },
          $set: { 
            'data.action': '휴식',
            'data.arg': {},
            'data.brief': '휴식'
          }
        }
      );
    } else if (invalidTurnList < 0) {
      await GeneralTurn.updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
          'data.turn_idx': { $lt: 0 }
        },
        {
          $inc: { 'data.turn_idx': MAX_TURN }
        }
      );
    }

    const general = await General.findOne({
      session_id: sessionId,
      'data.no': generalId
    });

    if (!general) {
      return {
        success: false,
        message: '장수를 찾을 수 없습니다'
      };
    }

    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      return {
        success: false,
        message: '세션을 찾을 수 없습니다'
      };
    }

    const turnTerm = session.data?.turnterm || 600;
    const year = session.data?.year || 180;
    let month = session.data?.month || 1;
    const lastExecute = session.data?.turntime || new Date();
    const turnTime = general.data?.turntime || new Date();

    const cutTurn = (time: Date, term: number) => {
      return Math.floor(new Date(time).getTime() / (term * 1000));
    };

    if (cutTurn(turnTime, turnTerm) > cutTurn(lastExecute, turnTerm)) {
      month++;
      if (month >= 13) {
        month = 1;
      }
    }

    return {
      success: true,
      result: true,
      turnTime,
      turnTerm,
      year,
      month,
      date: new Date(),
      turn: commandList,
      autorun_limit: general.data?.aux?.autorun_limit || null
    };
  }
}
