import { GeneralTurn } from '../../models/general_turn.model';

const MAX_TURN = 30;

export class RepeatCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const amount = parseInt(data.amount);

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다' };
    }

    if (isNaN(amount) || amount < 1 || amount > 12) {
      return { success: false, message: 'amount는 1 ~ 12 사이여야 합니다' };
    }

    await repeatGeneralCommand(sessionId, generalId, amount);

    return {
      success: true,
      result: true
    };
  }
}

async function repeatGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
  if (turnCnt <= 0 || turnCnt >= MAX_TURN) return;

  let reqTurn = turnCnt;
  if (turnCnt * 2 > MAX_TURN) {
    reqTurn = MAX_TURN - turnCnt;
  }

  const turnList = await (GeneralTurn as any).find({
    session_id: sessionId,
    'data.general_id': generalId,
    'data.turn_idx': { $lt: reqTurn }
  }).sort({ 'data.turn_idx': 1 });

  for (const turn of turnList) {
    const turnIdx = turn.data.turn_idx;
    const action = turn.data.action;
    const arg = turn.data.arg;
    const brief = turn.data.brief;

    const targetIndices: number[] = [];
    for (let i = turnIdx + turnCnt; i < MAX_TURN; i += turnCnt) {
      targetIndices.push(i);
    }

    if (targetIndices.length > 0) {
      await (GeneralTurn as any).updateMany(
        {
          session_id: sessionId,
          'data.general_id': generalId,
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
